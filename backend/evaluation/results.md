# DeepForge Detection Evaluation Results

- **Evaluated Dataset:** `test_data`
- **Total Samples:** 6 (Real: 3, Fake: 3)
- **Accuracy:** 50.00%
- **Precision:** 0.00%
- **Recall:** 0.00%
- **F1 Score:** 0.0000
- **ROC-AUC:** 0.0000

## Confusion Matrix (Threshold 0.50)

| | Predicted Real | Predicted Fake |
|---|---|---|
| **True Real** | 3 | 0 |
| **True Fake** | 3 | 0 |

## Threshold Sweep Analysis

- **Optimal F1 Threshold:** `0.05` (F1 = `0.6667`)
- **Optimal Youden's J Threshold:** `0.05` (J = `0.0`)

| Threshold | Accuracy | Precision | Recall | Specificity | F1 Score |
|-----------|----------|-----------|--------|-------------|----------|
| 0.05 | 50.0% | 50.0% | 100.0% | 0.0% | 0.6667 |
| 0.10 | 50.0% | 50.0% | 100.0% | 0.0% | 0.6667 |
| 0.15 | 50.0% | 50.0% | 100.0% | 0.0% | 0.6667 |
| 0.20 | 50.0% | 50.0% | 100.0% | 0.0% | 0.6667 |
| 0.25 | 50.0% | 50.0% | 100.0% | 0.0% | 0.6667 |
| 0.30 | 50.0% | 50.0% | 100.0% | 0.0% | 0.6667 |
| 0.35 | 50.0% | 50.0% | 100.0% | 0.0% | 0.6667 |
| 0.40 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0000 |
| 0.45 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0000 |
| 0.50 | 50.0% | 0.0% | 0.0% | 100.0% | 0.0000 |
| 0.55 | 50.0% | 0.0% | 0.0% | 100.0% | 0.0000 |
| 0.60 | 50.0% | 0.0% | 0.0% | 100.0% | 0.0000 |
| 0.65 | 50.0% | 0.0% | 0.0% | 100.0% | 0.0000 |
| 0.70 | 50.0% | 0.0% | 0.0% | 100.0% | 0.0000 |
| 0.75 | 50.0% | 0.0% | 0.0% | 100.0% | 0.0000 |
| 0.80 | 50.0% | 0.0% | 0.0% | 100.0% | 0.0000 |
| 0.85 | 50.0% | 0.0% | 0.0% | 100.0% | 0.0000 |
| 0.90 | 50.0% | 0.0% | 0.0% | 100.0% | 0.0000 |
| 0.95 | 50.0% | 0.0% | 0.0% | 100.0% | 0.0000 |

## Error Analysis

- **False Positives (Real predicted as Fake):** 0
- **False Negatives (Fake predicted as Real):** 3
  - `fake_1.jpg`: score = `0.3780`, verdict = `uncertain`
  - `fake_2.jpg`: score = `0.3780`, verdict = `uncertain`
  - `fake_3.jpg`: score = `0.3780`, verdict = `uncertain`
