#!/usr/bin/env python3
"""DeepForge image analysis evaluation and diagnostic tooling.

This script evaluates image detection performance by:
1. Running inference on test images using DeepForge's detection pipeline
2. Computing confusion matrix, precision, recall, specificity, F1, and ROC-AUC
3. Running a threshold sweep to identify optimal operating points (Best F1 and Youden's J)
4. Logging and exporting top misclassified samples (False Positives and False Negatives)
   with their predicted probabilities and per-model diagnostics

Usage:
    python evaluate.py --test-images test_data
    python evaluate.py --test-images test_data --output-dir evaluation
"""

import argparse
import csv
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

# Ensure the backend directory is in sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
WORKSPACE_ROOT = SCRIPT_DIR.parent
if str(WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKSPACE_ROOT))

# Optional matplotlib import
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

from sklearn.metrics import (
    auc,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_curve,
)

from app.services.detection_service import detection_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("evaluate")


def load_image(path: Path) -> Optional[Image.Image]:
    """Load and validate an image file, converting to RGB."""
    try:
        with Image.open(path) as img:
            return img.convert("RGB")
    except Exception as exc:
        logger.error(f"Failed to load image {path}: {exc}")
        return None


def determine_ground_truth(img_path: Path) -> Optional[int]:
    """Determine ground truth label (0=real, 1=fake) from path or filename."""
    path_lower = str(img_path).lower()
    parts = [p.lower() for p in img_path.parts]
    stem = img_path.stem.lower()

    # Prioritize immediate parent directory or filename markers
    if "fake" in parts or "fake" in stem or "manipulated" in parts or "manipulated" in stem:
        return 1
    if "real" in parts or "real" in stem or "authentic" in parts or "authentic" in stem:
        return 0

    return None


def get_fake_probability(result: Dict[str, Any]) -> float:
    """Extract probability of image being fake from detection result."""
    combined_score = result.get("combined_score")
    if combined_score is not None:
        return float(combined_score)

    # Fallback to per-model results if combined_score is not set
    for mres in result.get("per_model_results", []):
        if mres.get("model_available") and mres.get("confidence") is not None:
            return float(mres["confidence"])

    return 0.5


def run_threshold_sweep(
    y_true: np.ndarray,
    y_scores: np.ndarray,
    thresholds: Optional[List[float]] = None,
) -> Dict[str, Any]:
    """Sweep decision thresholds and compute classification metrics."""
    if thresholds is None:
        thresholds = [round(t, 2) for t in np.arange(0.05, 1.00, 0.05)]

    sweep_records = []
    best_f1 = -1.0
    best_f1_threshold = 0.50
    best_j = -1.0
    best_j_threshold = 0.50

    for t in thresholds:
        preds = (y_scores >= t).astype(int)
        cm = confusion_matrix(y_true, preds, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()

        accuracy = float((tp + tn) / (tp + tn + fp + fn)) if (tp + tn + fp + fn) > 0 else 0.0
        precision = float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        recall = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0  # Sensitivity / TPR
        specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0  # TNR
        f1 = float(2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
        youden_j = recall + specificity - 1.0

        if f1 > best_f1:
            best_f1 = f1
            best_f1_threshold = t

        if youden_j > best_j:
            best_j = youden_j
            best_j_threshold = t

        sweep_records.append({
            "threshold": t,
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "specificity": round(specificity, 4),
            "f1": round(f1, 4),
            "youden_j": round(youden_j, 4),
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
        })

    return {
        "sweep": sweep_records,
        "best_f1_threshold": best_f1_threshold,
        "best_f1": round(best_f1, 4),
        "best_j_threshold": best_j_threshold,
        "best_j": round(best_j, 4),
    }


def evaluate_dataset(image_files: List[Path]) -> Dict[str, Any]:
    """Run detection and evaluation on the collection of image files."""
    detection_service.initialize()

    y_true: List[int] = []
    y_pred_default: List[int] = []
    y_scores: List[float] = []
    sample_records: List[Dict[str, Any]] = []
    false_positives: List[Dict[str, Any]] = []
    false_negatives: List[Dict[str, Any]] = []

    for img_path in sorted(image_files):
        label = determine_ground_truth(img_path)
        if label is None:
            logger.warning(f"Could not determine ground truth label for {img_path}; skipping.")
            continue

        img = load_image(img_path)
        if img is None:
            continue

        try:
            result = detection_service.detect(img)
        except Exception as exc:
            logger.error(f"Detection failed for {img_path}: {exc}")
            continue

        fake_prob = get_fake_probability(result)
        combined_verdict = result.get("combined_verdict", "uncertain")

        # Binary prediction at standard 0.50 threshold
        pred_label = 1 if fake_prob >= 0.50 else 0

        y_true.append(label)
        y_pred_default.append(pred_label)
        y_scores.append(fake_prob)

        record = {
            "path": str(img_path),
            "filename": img_path.name,
            "true_label": label,
            "true_label_name": "fake" if label == 1 else "real",
            "pred_label": pred_label,
            "pred_label_name": "fake" if pred_label == 1 else "real",
            "fake_prob": round(fake_prob, 4),
            "combined_verdict": combined_verdict,
            "per_model": [
                {
                    "model": m.get("model_name"),
                    "prediction": m.get("prediction"),
                    "confidence": m.get("confidence"),
                    "available": m.get("model_available"),
                }
                for m in result.get("per_model_results", [])
            ],
        }
        sample_records.append(record)

        # Record error diagnostics
        if label == 0 and pred_label == 1:
            record["error_type"] = "False Positive (Real flagged as Fake)"
            false_positives.append(record)
        elif label == 1 and pred_label == 0:
            record["error_type"] = "False Negative (Fake missed as Real)"
            false_negatives.append(record)

    # Sort false positives by highest fake_prob (most severe false alarms)
    false_positives.sort(key=lambda x: x["fake_prob"], reverse=True)
    # Sort false negatives by lowest fake_prob (most severe misses)
    false_negatives.sort(key=lambda x: x["fake_prob"])

    y_true_arr = np.array(y_true)
    y_pred_arr = np.array(y_pred_default)
    y_scores_arr = np.array(y_scores)

    return {
        "y_true": y_true_arr,
        "y_pred": y_pred_arr,
        "y_scores": y_scores_arr,
        "sample_records": sample_records,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
    }


def plot_roc_curve(y_true: np.ndarray, y_scores: np.ndarray, output_path: Path) -> Optional[float]:
    """Plot and save ROC curve if matplotlib is available and both classes exist."""
    unique_classes = np.unique(y_true)
    if len(unique_classes) < 2:
        logger.warning("ROC-AUC cannot be computed: test dataset does not contain both classes.")
        return None

    fpr, tpr, _ = roc_curve(y_true, y_scores)
    roc_auc = float(auc(fpr, tpr))

    if HAS_MATPLOTLIB:
        try:
            plt.figure(figsize=(7, 6))
            plt.plot(fpr, tpr, color="#2563eb", lw=2, label=f"ROC Curve (AUC = {roc_auc:.4f})")
            plt.plot([0, 1], [0, 1], color="#94a3b8", lw=1, linestyle="--")
            plt.xlim([0.0, 1.0])
            plt.ylim([0.0, 1.05])
            plt.xlabel("False Positive Rate (1 - Specificity)")
            plt.ylabel("True Positive Rate (Recall)")
            plt.title("DeepForge Image Analysis — ROC Curve")
            plt.legend(loc="lower right")
            plt.grid(True, alpha=0.3)
            plt.tight_layout()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            plt.savefig(output_path, dpi=200)
            plt.close()
            logger.info(f"ROC curve plot saved to {output_path}")
        except Exception as exc:
            logger.warning(f"Could not save ROC plot: {exc}")

    return roc_auc


def export_misclassified_csv(
    false_positives: List[Dict[str, Any]],
    false_negatives: List[Dict[str, Any]],
    output_path: Path,
):
    """Write misclassified cases to CSV for detailed error inspection."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "error_type",
            "image_path",
            "true_label",
            "pred_label",
            "fake_probability",
            "combined_verdict",
            "model_breakdown",
        ])
        for fp in false_positives:
            writer.writerow([
                "FALSE_POSITIVE",
                fp["path"],
                fp["true_label_name"],
                fp["pred_label_name"],
                fp["fake_prob"],
                fp["combined_verdict"],
                json.dumps(fp["per_model"]),
            ])
        for fn in false_negatives:
            writer.writerow([
                "FALSE_NEGATIVE",
                fn["path"],
                fn["true_label_name"],
                fn["pred_label_name"],
                fn["fake_prob"],
                fn["combined_verdict"],
                json.dumps(fn["per_model"]),
            ])
    logger.info(f"Saved {len(false_positives) + len(false_negatives)} misclassified samples to {output_path}")


def main():
    parser = argparse.ArgumentParser(description="DeepForge image detection evaluation")
    parser.add_argument(
        "--test-images",
        type=str,
        default="test_data",
        help="Directory containing test images (e.g. test_data)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="evaluation",
        help="Directory to save evaluation results and diagnostics",
    )
    args = parser.parse_args()

    test_images_dir = Path(args.test_images)
    if not test_images_dir.exists():
        logger.error(f"Test directory not found: {test_images_dir}")
        sys.exit(1)

    # Collect images
    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}
    image_files = [p for p in test_images_dir.rglob("*") if p.suffix.lower() in image_extensions]

    if not image_files:
        logger.error(f"No image files found in {test_images_dir}")
        sys.exit(1)

    logger.info(f"Found {len(image_files)} image files to evaluate in '{test_images_dir}'")

    eval_data = evaluate_dataset(image_files)
    y_true = eval_data["y_true"]
    y_pred = eval_data["y_pred"]
    y_scores = eval_data["y_scores"]
    fps = eval_data["false_positives"]
    fns = eval_data["false_negatives"]

    total = len(y_true)
    if total == 0:
        logger.error("No valid labeled images could be evaluated.")
        sys.exit(1)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Compute Confusion Matrix and Standard Metrics
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    accuracy = float((tp + tn) / total)
    precision = float(precision_score(y_true, y_pred, zero_division=0))
    recall = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    specificity = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0

    # ROC-AUC
    roc_plot_path = output_dir / "roc_curve.png"
    roc_auc = plot_roc_curve(y_true, y_scores, roc_plot_path)

    # Threshold Sweep
    sweep_results = run_threshold_sweep(y_true, y_scores)

    # Print Summary Report to Console
    print("\n" + "=" * 65)
    print("           DEEPFORGE IMAGE ANALYSIS EVALUATION REPORT")
    print("=" * 65)
    print(f"Total Evaluated Samples : {total}")
    print(f"Ground Truth Counts     : Real={int(np.sum(y_true == 0))}, Fake={int(np.sum(y_true == 1))}")
    print("\n--- Confusion Matrix (Threshold = 0.50) ---")
    print(f"                Predicted Real (0)   Predicted Fake (1)")
    print(f"True Real (0) : {tn:18d}   {fp:18d}")
    print(f"True Fake (1) : {fn:18d}   {tp:18d}")
    print("\n--- Primary Metrics (Threshold = 0.50) ---")
    print(f"Accuracy    : {accuracy * 100:.2f}%")
    print(f"Precision   : {precision * 100:.2f}%")
    print(f"Recall (TPR): {recall * 100:.2f}%")
    print(f"Specificity : {specificity * 100:.2f}%")
    print(f"F1 Score    : {f1:.4f}")
    if roc_auc is not None:
        print(f"ROC-AUC     : {roc_auc:.4f}")
    else:
        print(f"ROC-AUC     : N/A (requires multiple classes)")

    print("\n--- Threshold Sweep Highlights ---")
    print(f"Best F1 Score          : {sweep_results['best_f1']} at threshold {sweep_results['best_f1_threshold']:.2f}")
    print(f"Best Youden's J Index  : {sweep_results['best_j']} at threshold {sweep_results['best_j_threshold']:.2f}")

    print("\n--- Selected Threshold Operating Points ---")
    print(f"{'Threshold':>9} | {'Accuracy':>8} | {'Precision':>9} | {'Recall':>8} | {'Specificity':>11} | {'F1':>6}")
    print("-" * 65)
    for row in sweep_results["sweep"]:
        if row["threshold"] in [0.20, 0.35, 0.50, 0.65, 0.80] or row["threshold"] == sweep_results["best_f1_threshold"]:
            marker = " *" if row["threshold"] == sweep_results["best_f1_threshold"] else ""
            print(
                f"{row['threshold']:9.2f} | "
                f"{row['accuracy'] * 100:7.1f}% | "
                f"{row['precision'] * 100:8.1f}% | "
                f"{row['recall'] * 100:7.1f}% | "
                f"{row['specificity'] * 100:10.1f}% | "
                f"{row['f1']:6.4f}{marker}"
            )

    print("\n--- Error Breakdown ---")
    print(f"False Positives (Real misclassified as Fake): {len(fps)}")
    for i, fp_item in enumerate(fps[:5], 1):
        print(f"  {i}. {fp_item['filename']} -> fake_prob={fp_item['fake_prob']:.4f} (verdict: {fp_item['combined_verdict']})")
    print(f"False Negatives (Fake misclassified as Real): {len(fns)}")
    for i, fn_item in enumerate(fns[:5], 1):
        print(f"  {i}. {fn_item['filename']} -> fake_prob={fn_item['fake_prob']:.4f} (verdict: {fn_item['combined_verdict']})")
    print("=" * 65 + "\n")

    # Save outputs
    misclassified_csv = output_dir / "misclassified.csv"
    export_misclassified_csv(fps, fns, misclassified_csv)

    results_json = output_dir / "evaluation_summary.json"
    summary_data = {
        "dataset_path": str(test_images_dir),
        "total_samples": total,
        "class_distribution": {
            "real": int(np.sum(y_true == 0)),
            "fake": int(np.sum(y_true == 1)),
        },
        "metrics_default_threshold_0_50": {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "specificity": round(specificity, 4),
            "f1": round(f1, 4),
            "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
            "confusion_matrix": {
                "tp": int(tp),
                "fp": int(fp),
                "tn": int(tn),
                "fn": int(fn),
            },
        },
        "threshold_sweep": sweep_results,
        "false_positive_count": len(fps),
        "false_negative_count": len(fns),
        "top_false_positives": fps[:10],
        "top_false_negatives": fns[:10],
    }
    with open(results_json, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2)
    logger.info(f"Evaluation summary JSON saved to {results_json}")

    # Write Markdown results report
    results_md = output_dir / "results.md"
    with open(results_md, "w", encoding="utf-8") as f:
        f.write("# DeepForge Detection Evaluation Results\n\n")
        f.write(f"- **Evaluated Dataset:** `{test_images_dir}`\n")
        f.write(f"- **Total Samples:** {total} (Real: {int(np.sum(y_true == 0))}, Fake: {int(np.sum(y_true == 1))})\n")
        f.write(f"- **Accuracy:** {accuracy * 100:.2f}%\n")
        f.write(f"- **Precision:** {precision * 100:.2f}%\n")
        f.write(f"- **Recall:** {recall * 100:.2f}%\n")
        f.write(f"- **F1 Score:** {f1:.4f}\n")
        if roc_auc is not None:
            f.write(f"- **ROC-AUC:** {roc_auc:.4f}\n\n")
        else:
            f.write("- **ROC-AUC:** N/A\n\n")

        f.write("## Confusion Matrix (Threshold 0.50)\n\n")
        f.write("| | Predicted Real | Predicted Fake |\n")
        f.write("|---|---|---|\n")
        f.write(f"| **True Real** | {tn} | {fp} |\n")
        f.write(f"| **True Fake** | {fn} | {tp} |\n\n")

        f.write("## Threshold Sweep Analysis\n\n")
        f.write(f"- **Optimal F1 Threshold:** `{sweep_results['best_f1_threshold']:.2f}` (F1 = `{sweep_results['best_f1']}`)\n")
        f.write(f"- **Optimal Youden's J Threshold:** `{sweep_results['best_j_threshold']:.2f}` (J = `{sweep_results['best_j']}`)\n\n")
        f.write("| Threshold | Accuracy | Precision | Recall | Specificity | F1 Score |\n")
        f.write("|-----------|----------|-----------|--------|-------------|----------|\n")
        for row in sweep_results["sweep"]:
            f.write(
                f"| {row['threshold']:.2f} | {row['accuracy']*100:.1f}% | "
                f"{row['precision']*100:.1f}% | {row['recall']*100:.1f}% | "
                f"{row['specificity']*100:.1f}% | {row['f1']:.4f} |\n"
            )

        f.write("\n## Error Analysis\n\n")
        f.write(f"- **False Positives (Real predicted as Fake):** {len(fps)}\n")
        for item in fps[:5]:
            f.write(f"  - `{item['filename']}`: score = `{item['fake_prob']:.4f}`, verdict = `{item['combined_verdict']}`\n")
        f.write(f"- **False Negatives (Fake predicted as Real):** {len(fns)}\n")
        for item in fns[:5]:
            f.write(f"  - `{item['filename']}`: score = `{item['fake_prob']:.4f}`, verdict = `{item['combined_verdict']}`\n")

    logger.info(f"Summary markdown saved to {results_md}")


if __name__ == "__main__":
    main()
