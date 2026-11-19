import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatBytes } from "../lib/format";

type ValidationReason = "unsupported-type" | "too-large" | null;

function validateFile(
  file: File,
  acceptedExtensions: string[],
  maxSizeBytes: number,
): ValidationReason {
  const lowerName = file.name.toLowerCase();
  const hasKnownExtension = acceptedExtensions.some((ext) => lowerName.endsWith(ext));
  // Trust declared MIME type when the extension is missing/odd, otherwise require known ext.
  const looksLikeMedia =
    hasKnownExtension ||
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    file.type.startsWith("audio/") ||
    file.type === "";
  if (
    !looksLikeMedia ||
    (!hasKnownExtension && file.type !== "" &&
      !file.type.startsWith("image/") &&
      !file.type.startsWith("video/") &&
      !file.type.startsWith("audio/"))
  ) {
    return "unsupported-type";
  }
  if (file.size > maxSizeBytes) return "too-large";
  return null;
}

interface UploadZoneProps {
  /** Called with the selected file, or null when the selection is cleared. */
  onFileChange: (file: File | null) => void;
  /** Currently selected file (controlled, so the parent owns the flow). */
  file: File | null;
  disabled?: boolean;
  accept?: string; // e.g. ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
  maxSizeMB?: number;
}

const ERRORS: Record<Exclude<ValidationReason, null>, string> = {
  "unsupported-type": "Unsupported file type for this workspace.",
  "too-large": "File is too large for this workspace.",
};

export default function UploadZone({
  onFileChange,
  file,
  disabled = false,
  accept = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
  maxSizeMB = 50,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<ValidationReason>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const acceptedExtensions = acceptedExtensionsFromAccept(accept);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // Keep an object URL for the thumbnail and revoke it on change/unmount.
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const acceptFile = useCallback(
    (candidate: File) => {
      const reason = validateFile(candidate, acceptedExtensions, maxSizeBytes);
      setError(reason);
      if (reason) {
        onFileChange(null);
        return;
      }
      onFileChange(candidate);
    },
    [acceptedExtensions, maxSizeBytes, onFileChange],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const clearFile = () => {
    setError(null);
    onFileChange(null);
  };

  const isMedia = file ? file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/") : false;
  const isImage = file ? file.type.startsWith("image/") : false;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={isImage ? "Choose an image file to analyze" : "Choose a media file to analyze"}
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) acceptFile(selected);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />

      <motion.div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={file ? `Selected file: ${file.name}. Click to choose a different file.` : "Upload a media file. Click to browse or drag and drop."}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        animate={{
          scale: isDragging ? 1.01 : 1,
          borderColor: isDragging ? "rgba(34,211,238,0.6)" : "rgba(255,255,255,0.1)",
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`glass-subtle relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors sm:py-14 ${
          isDragging ? "bg-accent-cyan/5" : ""
        } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-white/20"}`}
        style={{ borderStyle: "dashed" }}
      >
        <AnimatePresence mode="wait">
          {file ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col items-center gap-4"
            >
              <div className="border-accent-gradient relative h-32 w-32 overflow-hidden rounded-xl sm:h-40 sm:w-40">
                {isImage && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`Preview of ${file.name}`}
                    className="h-full w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-xl bg-white/5 text-3xl" aria-hidden="true">
                    {isImage ? "🖼️" : isMedia ? "🎬" : "📄"}
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/80">
                  preview
                </span>
              </div>
              <div className="max-w-sm">
                <p className="truncate text-sm font-medium text-text-primary">{file.name}</p>
                <p className="mt-0.5 font-mono text-xs text-text-muted">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent-cyan disabled:opacity-50"
              >
                Remove file
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col items-center gap-3"
            >
              <motion.div
                aria-hidden="true"
                animate={isDragging ? { y: -6, scale: 1.1 } : { y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="bg-accent-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-black/80 shadow-lg"
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </motion.div>
              <div>
                <p className="text-base font-medium text-text-primary">
                  {isDragging ? "Drop your media here" : "Drag & drop your media here"}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  or <span className="text-accent-cyan underline underline-offset-2">click to browse</span>
                </p>
              </div>
              <p className="font-mono text-xs text-text-muted">
                {acceptedExtensions.join(" · ")} — max {maxSizeMB} MB
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-sm text-verdict-manipulated"
          >
            {ERRORS[error]}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function acceptedExtensionsFromAccept(accept: string): string[] {
  return accept
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);
}
