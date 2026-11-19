"""Image preprocessing utilities for DeepForge image detection."""

import logging
from pathlib import Path
from typing import Literal
from PIL import Image
import io

logger = logging.getLogger(__name__)

class ImagePreprocessor:
    """Preprocess images for model inference."""
    
    @staticmethod
    def validate_image(file_path: Path) -> bool:
        """Validate image file exists and is readable."""
        if not file_path.exists():
            logger.error(f"Image file not found: {file_path}")
            return False
        if not file_path.is_file():
            logger.error(f"Path is not a file: {file_path}")
            return False
        return True
    
    @staticmethod
    def load_image(file_path: Path) -> Image.Image:
        """Load image from file path, handling errors."""
        try:
            with Image.open(file_path) as img:
                # Convert to RGB if needed
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                return img
        except Exception as e:
            logger.error(f"Failed to load image {file_path}: {e}")
            raise ValueError(f"Invalid image file: {e}")
    
    @staticmethod
    def validate_format(file_path: Path) -> bool:
        """Check if file has a supported image format."""
        return file_path.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'}
    
    @staticmethod
    def validate_size(file_path: Path, max_size_bytes: int = 50 * 1024 * 1024) -> bool:
        """Check if image file size is within limits."""
        try:
            return file_path.stat().st_size <= max_size_bytes
        except OSError:
            return False
    
    @staticmethod
    def resize_image(image: Image.Image, size: tuple[int, int] = (224, 224)) -> Image.Image:
        """Resize image to target size while maintaining aspect ratio."""
        return image.resize(size, Image.Resampling.LANCZOS)
    
    @staticmethod
    def to_tensor(image: Image.Image) -> 'torch.Tensor':
        """Convert PIL Image to torch Tensor with normalization."""
        import torch
        from torchvision import transforms
        
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        return transform(image)