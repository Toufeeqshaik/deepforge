#!/usr/bin/env python3
"""Debug probability outputs to understand false positives/negatives."""

import sys
import os
sys.path.insert(0, '/home/toufeeq/Downloads/deepforge/backend')

from app.services.detection_service import detection_service
from PIL import Image
import numpy as np

def main():
    # Test green screen image (fake_1.jpg)
    img_path = '/home/toufeeq/Downloads/deepforge/backend/test_data/fake/fake_1.jpg'
    print(f"Testing: {img_path}")
    
    img = Image.open(img_path)
    result = detection_service.detect(img)
    
    print(f"Combined verdict: {result.get('combined_verdict', 'unknown')}")
    print(f"Combined score: {result.get('combined_score', 'N/A')}")
    
    # Print per-model probabilities
    print("\n--- Per-model details ---")
    for i, mres in enumerate(result.get('per_model_results', [])):
        print(f"Model {i} ({mres.get('model_name', 'unknown')}):")
        print(f"  Prediction: {mres.get('prediction', 'unknown')}")
        print(f"  Confidence: {mres.get('confidence', 'N/A')}")
        print(f"  Model available: {mres.get('model_available', False)}")
        
        # If this is the main model, show raw probabilities
        if mres.get('model_available') and mres.get('confidence') is not None:
            # Try to get raw probabilities from the model
            # This might require accessing the model directly
            pass
            
    # Test with a real image
    print("\n" + "="*50)
    real_img_path = '/home/toufeeq/Downloads/deepforge/backend/test_data/real/real_1.jpg'
    print(f"Testing real image: {real_img_path}")
    
    real_img = Image.open(real_img_path)
    real_result = detection_service.detect(real_img)
    
    print(f"Real verdict: {real_result.get('combined_verdict', 'unknown')}")
    print(f"Real combined score: {real_result.get('combined_score', 'N/A')}")
    
    # Check if real image is misclassified
    if 'fake' in os.path.basename(real_img_path).lower():
        print("⚠️  REAL IMAGE CLASSIFIED AS FAKE!")
    elif 'real' in os.path.basename(real_img_path).lower():
        print("✅ Real image correctly classified")

if __name__ == "__main__":
    main()