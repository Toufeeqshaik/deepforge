"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface AxonParticleFieldProps {
  className?: string;
  particleCount?: number;
  reducedMotionFallback?: React.ReactNode;
}

const PALETTE = ["#38BDF8", "#2DD4BF", "#A855F7", "#C084FC"];
const TAU = Math.PI * 2;

function createFallbackPath(index: number): string {
  const phase = index * 2.399963;
  const loop = index % 3 === 1;
  const points = 240;
  const coordinates: string[] = [];

  for (let point = 0; point <= points; point++) {
    const progress = point / points;
    const angle = progress * TAU * (loop ? 1 : 2.35) + phase;
    let x: number;
    let y: number;

    if (loop) {
      const radiusX = 218 + (index % 5) * 25;
      const radiusY = 142 + (index % 4) * 18;
      x = 500 + radiusX * Math.cos(angle) + 78 * Math.cos(angle * 3 + phase * 0.7);
      y = 300 + radiusY * Math.sin(angle) + 52 * Math.sin(angle * 2 - phase);
    } else {
      const radius = 12 + progress * (242 + (index % 4) * 14);
      const modulatedRadius = radius + 24 * Math.sin(angle * 2.1 + phase);
      x = 500 + modulatedRadius * Math.cos(angle) + 34 * Math.cos(angle * 2.7 - phase);
      y = 300 + modulatedRadius * 0.72 * Math.sin(angle) + 28 * Math.sin(angle * 3.2 + phase);
    }

    coordinates.push(`${point === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return coordinates.join(" ");
}

const FALLBACK_FILAMENTS = Array.from({ length: 30 }, (_, index) => ({
  path: createFallbackPath(index),
  color: PALETTE[index % PALETTE.length],
  opacity: index % 4 === 0 ? 0.42 : 0.23,
}));

type Filament = {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  phase: number;
};

function createFilamentGeometry(
  index: number,
  strand: number,
  count: number,
): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const phase = index * 2.399963 + strand * 0.045;
  const isLoop = index % 3 === 1;
  const rotation = index * 0.754877666;
  const cosRotation = Math.cos(rotation);
  const sinRotation = Math.sin(rotation);
  const strandOffset = (strand - 1) * 0.025;

  for (let point = 0; point < count; point++) {
    const progress = point / (count - 1);
    const angle = progress * TAU * (isLoop ? 1 : 2.45) + phase;
    let x: number;
    let y: number;
    let z: number;

    if (isLoop) {
      const radiusX = 0.62 + (index % 5) * 0.16;
      const radiusY = 0.47 + (index % 4) * 0.13;
      x = radiusX * Math.cos(angle) + 0.28 * Math.cos(angle * 3 + phase * 0.7);
      y = radiusY * Math.sin(angle) + 0.22 * Math.sin(angle * 2 - phase);
      z = 0.28 * Math.sin(angle * 2 + phase) + 0.12 * Math.cos(angle * 3);
    } else {
      const radius = 0.08 + progress * (1.55 + (index % 4) * 0.11);
      const modulatedRadius = radius + 0.16 * Math.sin(angle * 2.1 + phase);
      x = modulatedRadius * Math.cos(angle) + 0.20 * Math.cos(angle * 2.7 - phase);
      y = modulatedRadius * 0.72 * Math.sin(angle) + 0.18 * Math.sin(angle * 3.2 + phase);
      z = 0.30 * Math.sin(angle * 1.35 + phase) + 0.12 * Math.cos(angle * 2.2);
    }

    const rotatedX = x * cosRotation - y * sinRotation;
    const rotatedY = x * sinRotation + y * cosRotation;
    const radialLength = Math.max(0.001, Math.hypot(rotatedX, rotatedY));
    const offsetScale = 1 + strandOffset / radialLength;
    const offset = point * 3;
    positions[offset] = rotatedX * offsetScale;
    positions[offset + 1] = rotatedY * offsetScale;
    positions[offset + 2] = z + (strand - 1) * 0.012;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function createStarField(count: number, aspect: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const cyan = new THREE.Color(PALETTE[0]);
  const white = new THREE.Color("#E8F4FF");

  for (let index = 0; index < count; index++) {
    const offset = index * 3;
    positions[offset] = (Math.random() - 0.5) * aspect * 9.5;
    positions[offset + 1] = (Math.random() - 0.5) * 7.2;
    positions[offset + 2] = -0.6 - Math.random() * 2.6;
    const tint = cyan.clone().lerp(white, Math.random() * 0.82);
    colors[offset] = tint.r;
    colors[offset + 1] = tint.g;
    colors[offset + 2] = tint.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export default function AxonParticleField({
  className = "",
  particleCount = 6000,
  reducedMotionFallback = null,
}: AxonParticleFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetPointerRef = useRef({ x: 0, y: 0 });
  const isVisibleRef = useRef(true);
  const isTabVisibleRef = useRef(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { rootMargin: "120px", threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onPointerMove = (event: MouseEvent | TouchEvent) => {
      const bounds = element.getBoundingClientRect();
      const touch = "touches" in event ? event.touches[0] : null;
      const clientX = touch?.clientX ?? ("clientX" in event ? event.clientX : 0);
      const clientY = touch?.clientY ?? ("clientY" in event ? event.clientY : 0);
      targetPointerRef.current.x =
        ((clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2;
      targetPointerRef.current.y =
        ((clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * -2;
    };
    element.addEventListener("mousemove", onPointerMove, { passive: true });
    element.addEventListener("touchmove", onPointerMove, { passive: true });
    return () => {
      element.removeEventListener("mousemove", onPointerMove);
      element.removeEventListener("touchmove", onPointerMove);
    };
  }, []);

  const init = useCallback((): (() => void) | undefined => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let renderer: THREE.WebGLRenderer | undefined;
    let rafId = 0;

    try {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const isNarrow = width < 640;
      const density = isNarrow ? 0.55 : width < 1024 ? 0.78 : 1;

      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height);
      renderer.setClearColor("#050608", 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
      camera.position.set(0, 0, 6.4);
      camera.lookAt(0, 0, 0);

      const starGeometry = createStarField(
        Math.max(900, Math.floor(particleCount * density)),
        width / height,
      );
      const stars = new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
          size: 0.014,
          vertexColors: true,
          transparent: true,
          opacity: 0.78,
          sizeAttenuation: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      scene.add(stars);

      const filamentGroup = new THREE.Group();
      const filaments: Filament[] = [];
      const materials: THREE.LineBasicMaterial[] = [];
      const filamentCount = width < 640 ? 20 : 34;
      const pointCount = width < 640 ? 300 : 440;

      for (let index = 0; index < filamentCount; index++) {
        for (let strand = 0; strand < 3; strand++) {
          const geometry = createFilamentGeometry(index, strand, pointCount);
          const basePositions = (geometry.getAttribute("position") as THREE.BufferAttribute)
            .array as Float32Array;
          const positions = new Float32Array(basePositions);
          const color = new THREE.Color(PALETTE[(index + strand) % PALETTE.length]);
          const material = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: strand === 1 ? 0.36 : 0.18,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          });
          const line = new THREE.Line(geometry, material);
          line.frustumCulled = false;
          filamentGroup.add(line);
          filaments.push({ geometry, positions, phase: index * 0.63 + strand * 1.7 });
          materials.push(material);
        }
      }
      scene.add(filamentGroup);

      const render = () => renderer?.render(scene, camera);
      let elapsed = 0;
      let lastTime = performance.now();
      let pointerX = 0;
      let pointerY = 0;

      const animate = (time: number) => {
        if (!renderer) return;
        rafId = requestAnimationFrame(animate);
        if (!isTabVisibleRef.current || !isVisibleRef.current) {
          lastTime = time;
          return;
        }

        const delta = Math.min((time - lastTime) / 1000, 0.05);
        lastTime = time;
        elapsed += delta;
        pointerX += (targetPointerRef.current.x - pointerX) * 0.035;
        pointerY += (targetPointerRef.current.y - pointerY) * 0.035;

        filamentGroup.rotation.z = Math.sin(elapsed * 0.12) * 0.08;
        filamentGroup.rotation.x = pointerY * 0.055 + Math.sin(elapsed * 0.16) * 0.025;
        filamentGroup.rotation.y = pointerX * 0.055 + Math.cos(elapsed * 0.13) * 0.025;
        filamentGroup.position.x = pointerX * 0.12;
        filamentGroup.position.y = pointerY * 0.08;
        stars.rotation.z = elapsed * 0.002;
        camera.position.x += (pointerX * 0.08 - camera.position.x) * 0.012;
        camera.position.y += (pointerY * 0.06 - camera.position.y) * 0.012;
        camera.lookAt(0, 0, 0);

        filaments.forEach(({ geometry, positions, phase }) => {
          const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
          for (let vertex = 0; vertex < positions.length; vertex += 3) {
            const x = positions[vertex];
            const y = positions[vertex + 1];
            const z = positions[vertex + 2];
            attribute.array[vertex] = x + Math.sin(elapsed * 0.42 + phase + y) * 0.018;
            attribute.array[vertex + 1] = y + Math.cos(elapsed * 0.36 + phase + x) * 0.018;
            attribute.array[vertex + 2] = z + Math.sin(elapsed * 0.5 + phase + x * 1.8) * 0.075;
          }
          attribute.needsUpdate = true;
        });

        materials.forEach((material, index) => {
          material.opacity = (index % 3 === 1 ? 0.32 : 0.16) *
            (0.82 + Math.sin(elapsed * 0.7 + index) * 0.18);
        });
        render();
      };

      if (reducedMotion) {
        render();
      } else {
        rafId = requestAnimationFrame(animate);
      }

      const onResize = () => {
        const nextWidth = Math.max(1, container.clientWidth);
        const nextHeight = Math.max(1, container.clientHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        renderer?.setSize(nextWidth, nextHeight);
        render();
      };
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(rafId);
        filaments.forEach(({ geometry }) => geometry.dispose());
        materials.forEach((material) => material.dispose());
        starGeometry.dispose();
        (stars.material as THREE.Material).dispose();
        renderer?.dispose();
      };
    } catch (error) {
      console.warn("[AxonParticleField] WebGL init failed; using the static fallback.", error);
      renderer?.dispose();
      setWebglFailed(true);
      return;
    }
  }, [particleCount, reducedMotion]);

  useEffect(() => {
    if (webglFailed) return;
    return init();
  }, [init, webglFailed]);

  const showFallback = webglFailed;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {showFallback ? (
        <div className="absolute inset-0 bg-[#050608]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(1px 1px at 6% 14%, rgba(232,244,255,.84) 55%, transparent 100%), radial-gradient(1px 1px at 18% 72%, rgba(56,189,248,.75) 55%, transparent 100%), radial-gradient(1px 1px at 31% 42%, rgba(232,244,255,.64) 55%, transparent 100%), radial-gradient(1px 1px at 47% 9%, rgba(45,212,191,.7) 55%, transparent 100%), radial-gradient(1px 1px at 67% 78%, rgba(192,132,252,.72) 55%, transparent 100%), radial-gradient(1px 1px at 83% 27%, rgba(232,244,255,.78) 55%, transparent 100%), radial-gradient(1px 1px at 94% 66%, rgba(56,189,248,.68) 55%, transparent 100%), radial-gradient(ellipse at 52% 48%, rgba(56,189,248,.1), transparent 48%), radial-gradient(ellipse at 56% 50%, rgba(168,85,247,.09), transparent 58%)",
            }}
          />
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1000 600"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter id="axon-fallback-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {FALLBACK_FILAMENTS.map((filament, index) => (
              <g key={index} fill="none" stroke={filament.color} strokeLinecap="round">
                <path
                  d={filament.path}
                  strokeWidth="3.2"
                  opacity={filament.opacity * 0.22}
                  filter="url(#axon-fallback-glow)"
                />
                <path d={filament.path} strokeWidth="0.8" opacity={filament.opacity} />
              </g>
            ))}
          </svg>
        </div>
      ) : (
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      )}
      {showFallback && reducedMotionFallback}
    </div>
  );
}
