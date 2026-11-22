#!/usr/bin/env python3
"""Quick evaluation script to test current model behavior on test data."""

import os
import sys
from pathlib import Path
import torch
import numpy as np
from PIL import Image
import logging

# Add backend to path
sys.path.insert(0, '/home/toufeeq/Downloads/deepforge/backend')

from app.services.detection_service import detection_service
from app.detectors.image.fallback import FallbackImageDetector

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('evaluation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def main():
    test_data_dir = Path('/home/toufeeq/Downloads/deepforge/backend/test_data')
    
    # Collect test images
    test_images = []
    for label_dir in ['real', 'fake']:
        dir_path = test_data_dir / label_dir
        if dir_path.exists():
            for img_path in dir_path.iterdir():
                if img_path.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']:
                    test_images.append((img_path, label_dir))
    
    logger.info(f"Found {len(test_images)} test images")
    
    # Test a few samples
    for img_path, true_label in test_images[:6]:  # Test first 6 images
        try:
            # Load and detect
            img = Image.open(img_path)
            result = detection_service.detect(img)
            
            # Extract combined score and verdict
            combined_score = result.get('combined_score')
            combined_verdict = result.get('combined_verdict', 'unknown')
            
            # Parse label from filename
            pred_label = 'fake' if 'fake' in img_path.name.lower() else 'real'
            true_label_str = 'fake' if true_label == 'fake' else 'real'
            
            logger.info(f"{img_path.name}:")
            logger.info(f"  True: {true_label_str}")
            logger.info(f"  Predicted: {pred_label}")
            logger.info(f"  Combined score: {combined_score:.4f}")
            logger.info(f"  Combined verdict: {combined_verdict}")
            
            # Check if prediction matches expectation
            if (true_label == 'fake' and combined_verdict != 'likely_manipulated' and combined_verdict != 'potentially_manipulated') or \
               (true_label == 'real' and combined_verdict != 'likely_authentic'):
                logger.warning(f"  ❌ MISMATCH: Expected {true_label_str}, got {combined_verdict}")
                
        except Exception as e:
            logger.error(f"Error processing {img_path.name}: {e}")
    
    logger.info("Evaluation complete")

if __name__ == "__main__":
    main()