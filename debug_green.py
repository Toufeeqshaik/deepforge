#!/usr/bin/env python3
"""Debug green screen detection."""

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
    print(f"Image size: {img.size}")
    print(f"Image mode: {img.mode}")
    
    # Create a simple solid color image for comparison
    solid_color = Image.new('RGB', img.size, (0, 255, 0))  # Green
    print(f"Solid green image size: {solid_color.size}")
    
    # Test both images
    print("\n--- Green screen image ---")
    result1 = detection_service.detect(img)
    print(f"Verdict: {result1.get('combined_verdict', 'unknown')}")
    print(f"Score: {result1.get('combined_score', 'N/A')}")
    
    print("\n--- Solid green image ---")
    result2 = detection_service.detect(solid_color)
    print(f"Verdict: {result2.get('combined_verdict', 'unknown')}")
    print(f"Score: {result2.get('combined_score', 'N/A')}")
    
    # Check if they're classified differently
    if result1.get('combined_verdict') != result2.get('combined_verdict'):
        print("⚠️  DIFFERENT VERDICTS!")
    else:
        print("✅ Same verdict")

if __name__ == "__main__":
    main()