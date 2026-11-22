#!/usr/bin/env python3
"""Debug single image detection."""

import sys
import os
sys.path.insert(0, '/home/toufeeq/Downloads/deepforge/backend')

from app.services.detection_service import detection_service
from PIL import Image

def main():
    # Test green screen image (fake_1.jpg)
    img_path = '/home/toufeeq/Downloads/deepforge/backend/test_data/fake/fake_1.jpg'
    print(f"Testing: {img_path}")
    
    img = Image.open(img_path)
    result = detection_service.detect(img)
    
    print(f"Result keys: {list(result.keys())}")
    print(f"Combined verdict: {result.get('combined_verdict', 'unknown')}")
    print(f"Combined score: {result.get('combined_score', 'N/A')}")
    
    # Check per-model results
    print("\nPer-model results:")
    for i, mres in enumerate(result.get('per_model_results', [])):
        print(f"  Model {i}:")
        for key in ['prediction', 'confidence', 'model_available']:
            print(f"    {key}: {mres.get(key, 'N/A')}")

if __name__ == "__main__":
    main()