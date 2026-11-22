#!/usr/bin/env python3
"""Debug single image detection."""

import sys
sys.path.insert(0, '/home/toufeeq/Downloads/deepforge/backend')

from app.services.detection_service import detection_service
from PIL import Image

def main():
    # Test green screen image (fake_1.jpg)
    img_path = '/home/toufeeq/Downloads/deepforge/backend/test_data/fake/fake_1.jpg'
    print(f"Testing: {img_path}")
    
    img = Image.open(img_path)
    result = detection_service.detect(img)
    
    print(f"Result: {result}")
    print(f"Combined verdict: {result.get('combined_verdict', 'unknown')}")
    print(f"Combined score: {result.get('combined_score', 'N/A')}")
    
    # Check per-model results
    print("\nPer-model results:")
    for mres in result.get('per_model_results', []):
        print(f"  {mres.get('model_name')}: {mres.get('verdict')} ({mres.get('raw_score':.4f)})")

if __name__ == "__main__":
    main()