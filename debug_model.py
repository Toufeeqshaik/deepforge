#!/usr/bin/env python3
"""Debug model output for different image types."""

import sys
import os
sys.path.insert(0, '/home/toufeeq/Downloads/deepforge/backend')

from app.services.detection_service import detection_service
from PIL import Image
import torch
import torchvision.transforms as transforms
from torchvision import transforms as T

def preprocess_image(img):
    """Apply the same preprocessing as the model."""
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])
    return transform(img).unsqueeze(0)

def main():
    # Test green screen image (fake_1.jpg)
    img_path = '/home/toufeeq/Downloads/deepforge/backend/test_data/fake/fake_1.jpg'
    print(f"Testing: {img_path}")
    
    img = Image.open(img_path)
    print(f"Original image size: {img.size}")
    print(f"Original image mode: {img.mode}")
    
    # Apply preprocessing
    input_tensor = preprocess_image(img)
    print(f"Input tensor shape: {input_tensor.shape}")
    
    # Test with model
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
            
    # Test with a real image
    print("\n" + "="*50)
    real_img_path = '/home/toufeeq/Downloads/deepforge/backend/test_data/real/real_1.jpg'
    print(f"Testing real image: {real_img_path}")
    
    real_img = Image.open(real_img_path)
    print(f"Real image size: {real_img.size}")
    print(f"Real image mode: {real_img.mode}")
    
    real_input = preprocess_image(real_img)
    print(f"Real input tensor shape: {real_input.shape}")
    
    real_result = detection_service.detect(real_img)
    print(f"Real result keys: {list(real_result.keys())}")
    print(f"Real combined verdict: {real_result.get('combined_verdict', 'unknown')}")
    print(f"Real combined score: {real_result.get('combined_score', 'N/A')}")

if __name__ == "__main__":
    main()