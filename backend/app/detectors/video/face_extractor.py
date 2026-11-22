"""Face extraction utilities for video detection.

Uses OpenCV Haar cascades for face detection - lightweight and CPU-friendly.
"""

import time
import logging
import cv2
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
from app.core.config import settings
from app.core.exceptions import VideoValidationError

logger = logging.getLogger(__name__)

class FaceExtractor:
    """Face detection and extraction from video frames."""
    
    def __init__(self, 
                 cascade_path: Optional[Path] = None,
                 scale_factor: float = 1.1,
                 min_neighbors: int = 5,
                 min_size: Tuple[int, int] = (30, 30)):
        """
        Initialize face extractor.
        
        Args:
            cascade_path: Path to Haar cascade XML file. If None, uses default OpenCV cascade.
            scale_factor: How much the image size is reduced at each image scale
            min_neighbors: How many neighbors each candidate rectangle should have to retain it
            min_size: Minimum possible face size (width, height)
        """
        self.scale_factor = scale_factor
        self.min_neighbors = min_neighbors
        self.min_size = min_size
        
        # Load cascade
        if cascade_path and cascade_path.exists():
            self.face_cascade = cv2.CascadeClassifier(str(cascade_path))
        else:
            # Use default Haar cascade (located in OpenCV installation)
            self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            if self.face_cascade.empty():
                raise VideoValidationError("Failed to load face detection cascade")
                
        self._initialized = False
        
        # Torch threading tuned for Core Ultra 7 (16 logical CPUs).
        try:
            import torch
            torch.set_num_threads(8)
        except ImportError:
            pass

    def detect_faces(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """
        Detect faces in a video frame.
        
        Args:
            frame: RGB numpy array from video frame
            
        Returns:
            List of dictionaries containing face information:
            [
                {
                    'bbox': (x, y, width, height),
                    'confidence': float,
                    'timestamp': float,
                    'frame_index': int
                },
                ...
            ]
        """
        if frame is None or frame.size == 0:
            return []
            
        # Convert to grayscale for Haar cascade
        gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
        
        # Detect faces
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=self.scale_factor,
            minNeighbors=self.min_neighbors,
            minSize=self.min_size,
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        
        faces_info = []
        frame_height, frame_width = frame.shape[:2]
        frame_timestamp = time.time()
        
        for i, (x, y, w, h) in enumerate(faces):
            # Validate face size
            if w < self.min_size[0] or h < self.min_size[1]:
                continue
                
            # Calculate confidence (simple heuristic based on face size)
            face_area = w * h
            frame_area = frame_width * frame_height
            confidence = min(1.0, face_area / frame_area * 10)
            
            faces_info.append({
                'bbox': (x, y, w, h),
                'confidence': round(confidence, 3),
                'timestamp': frame_timestamp,
                'frame_index': 0,  # Will be set later by sampler
                'frame_width': frame_width,
                'frame_height': frame_height
            })
            
        logger.debug(f"Detected {len(faces_info)} faces in frame")
        return faces_info
        
    def extract_face_crops(self, frame: np.ndarray, faces: List[Dict[str, Any]]) -> List[Tuple[np.ndarray, Dict[str, Any]]]:
        """
        Extract face crops from frame based on detected faces.
        
        Args:
            frame: RGB numpy array
            faces: List of face detection results from detect_faces
            
        Returns:
            List of tuples: (face_crop, face_info)
        """
        crops = []
        frame_height, frame_width = frame.shape[:2]
        
        for face_info in faces:
            x, y, w, h = face_info['bbox']
            
            # Validate face crop bounds
            if x < 0 or y < 0 or x + w > frame_width or y + h > frame_height:
                continue
                
            # Extract face region
            face_crop = frame[y:y+h, x:x+w]
            
            # Validate crop size
            if face_crop.size == 0 or face_crop.shape[0] < self.min_size[0] or face_crop.shape[1] < self.min_size[1]:
                continue
                
            crops.append((face_crop, face_info))
            
        return crops
        
    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        return {
            "model_name": "Haar Cascade Face Detector",
            "model_version": "1.0.0",
            "is_available": True,
            "dependencies": ["opencv-python-headless"],
            "device_support": ["cpu"],
            "memory_footprint_mb": 5
        }