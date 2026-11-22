#!/usr/bin/env python3
"""Analyze probability distributions to understand false positives/negatives."""

import sys
import os
sys.path.insert(0, '/home/toufeeq/Downloads/deepforge/backend')

from app.services.detection_service import detection_service
from PIL import Image
import numpy as np
import matplotlib.pyplot as plt

def analyze_image(img_path, label):
    """Analyze a single image and return probability data."""
    img = Image.open(img_path)
    result = detection_service.detect(img)
    
    combined_verdict = result.get('combined_verdict', 'unknown')
    combined_score = result.get('combined_score', 0.0)
    
    # Get per-model probabilities
    per_model_probs = []
    for mres in result.get('per_model_results', []):
        if mres.get('model_available') and mres.get('confidence') is not None:
            per_model_probs.append(mres['confidence'])
    
    return {
        'image_path': img_path,
        'label': label,
        'combined_verdict': combined_verdict,
        'combined_score': combined_score,
        'per_model_probs': per_model_probs
    }

def main():
    test_data_dir = '/home/toufeeq/Downloads/deepforge/backend/test_data'
    
    # Collect data from test images
    data = []
    
    # Test fake images
    fake_dir = os.path.join(test_data_dir, 'fake')
    for fname in os.listdir(fake_dir):
        if fname.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            img_path = os.path.join(fake_dir, fname)
            data.append(analyze_image(img_path, 'fake'))
    
    # Test real images
    real_dir = os.path.join(test_data_dir, 'real')
    for fname in os.listdir(real_dir):
        if fname.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            img_path = os.path.join(real_dir, fname)
            data.append(analyze_image(img_path, 'real'))
    
    # Analyze probability distributions
    fake_scores = [item['combined_score'] for item in data if item['label'] == 'fake']
    real_scores = [item['combined_score'] for item in data if item['label'] == 'real']
    
    print(f"Analyzed {len(fake_scores)} fake images")
    print(f"Analyzed {len(real_scores)} real images")
    
    print(f"\nFake image scores (mean={np.mean(fake_scores):.3f}, std={np.std(fake_scores):.3f}):")
    for i, score in enumerate(fake_scores[:5]):  # Show first 5
        print(f"  {i+1}. {data[i*5]['image_path']}: {score:.4f}")
    
    print(f"\nReal image scores (mean={np.mean(real_scores):.3f}, std={np.std(real_scores):.3f}):")
    for i, score in enumerate(real_scores[:5]):
        print(f"  {i+1}. {data[len(fake_scores)+i]['image_path']}: {score:.4f}")
    
    # Plot probability distributions
    plt.figure(figsize=(10, 6))
    plt.hist(fake_scores, bins=20, alpha=0.7, label='Fake images', color='red')
    plt.hist(real_scores, bins=20, alpha=0.7, label='Real images', color='green')
    plt.axvline(x=0.65, color='black', linestyle='--', label='Decision threshold (0.65)')
    plt.xlabel('Combined probability of being fake')
    plt.ylabel('Number of images')
    plt.title('Probability Distribution for Real vs Fake Images')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig('/home/toufeeq/Downloads/deepforge/probability_distribution.png')
    print(f"\nProbability distribution saved to /home/toufeeq/Downloads/deepforge/probability_distribution.png")
    
    # Show some sample probabilities
    print(f"\nSample probabilities:")
    for i in range(min(5, len(data))):
        item = data[i]
        print(f"  {i+1}. {os.path.basename(data[i]['image_path'])}: {data[i]['combined_score']:.4f} ({data[i]['combined_verdict']})")

if __name__ == "__main__":
    main()