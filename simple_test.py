#!/usr/bin/env python3
import sys
sys.path.insert(0, '/home/toufeeq/Downloads/deepforge/backend')

from app.services.detection_service import detection_service
from PIL import Image

# Load and test a known fake image
img = Image.open('/home/toufeeq/Downloads/deepforge/backend/test_data/fake/fake_1.jpg')
result = detection_service.detect(img)

print("=== DETECTION RESULT ===")
print(f"File: /home/toufeeq/Downloads/deepforge/backend/test_data/fake/fake_1.jpg")
print(f"Combined verdict: {result.get('combined_verdict', 'unknown')}")
print(f"Combined score: {result.get('combined_score', 'N/A')}")
print(f"Model count: {result.get('model_count', 0)}")

print("\n--- Per-model results ---")
for i, mres in enumerate(result.get('per_model_results', [])):
    print(f"Model {i} ({mres.get('model_name', 'unknown')}):")
    print(f"  Prediction: {mres.get('prediction', 'unknown')}")
    print(f"  Confidence: {mres.get('confidence', 'N/A')}")
    print(f"  Model available: {mres.get('model_available', False)}")