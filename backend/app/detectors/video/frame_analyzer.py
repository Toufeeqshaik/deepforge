"""Frame analysis utilities for video detection.

Handles analysis of face crops using the Phase 3 image detector.
"""

import time
import logging
from typing import List, Dict, Any, Optional, Literal
from pathlib import Path
from PIL import Image
import numpy as np

from app.core.config import settings
from app.detectors.image import ImageDetectionService, ImageDetectionResult
from app.detectors.video.face_extractor import FaceExtractor
from app.detectors.video.video_loader import VideoLoader

logger = logging.getLogger(__name__)

class FrameAnalyzer:
    """Analyze face crops from video frames using image detection."""
    
    def __init__(self, 
                 image_detector_service: ImageDetectionService,
                 face_extractor: FaceExtractor,
                 max_face_crops: int = 4):
        """
        Initialize frame analyzer.
        
        Args:
            image_detector_service: The image detection service (from Phase 3)
            face_extractor: The face extractor for detecting faces in frames
            max_face_crops: Maximum number of face crops to analyze per frame
        """
        self._image_detector = image_detector_service
        self._face_extractor = face_extractor
        self._max_face_crops = max_face_crops
        self._initialized = False
        
        # Torch threading tuned for Core Ultra 7 (16 logical CPUs).
        try:
            import torch
            torch.set_num_threads(settings.TORCH_NUM_THREADS)
        except ImportError:
            pass

    def initialize(self) -> None:
        """Initialize the analyzer. Call once at startup."""
        if self._initialized:
            return
            
        try:
            # Verify image detector is available
            if not self._image_detector.is_available:
                logger.warning("Image detector not available - will return uncertain results")
                
            self._initialized = True
            logger.info("Frame analyzer initialized")
            
        except Exception as exc:
            logger.error(f"Failed to initialize frame analyzer: {exc}")
            raise

    def analyze_frame(self, frame: np.ndarray, frame_index: int, timestamp: float) -> List[Dict[str, Any]]:
        """
        Analyze a video frame for face manipulations.
        
        Args:
            frame: RGB numpy array from video frame
            frame_index: Index of the frame in the video
            timestamp: Timestamp of the frame
            
        Returns:
            List of dictionaries with frame-level analysis results
        """
        results = []
        
        if not self._initialized:
            self.initialize()
            
        # Detect faces in the frame
        faces = self._face_extractor.detect_faces(frame)
        logger.debug(f"Detected {len(faces)} faces in frame {frame_index}")
        
        # Limit number of face crops to analyze
        if len(faces) > self._max_face_crops:
            # Sort by confidence and take top N
            faces = sorted(faces, key=lambda x: x['confidence'], reverse=True)[:self._max_face_crops]
            
        # Analyze each face crop
        for face_info in faces:
            # Extract face crop
            x, y, w, h = face_info['bbox']
            face_crop = frame[y:y+h, x:x+w]
            
            # Convert to PIL Image for the image detector
            face_pil = Image.fromarray(face_crop)
            
            # Analyze the face crop
            try:
                start = time.perf_counter()
                detection_result = self._image_detector.detect(face_pil)
                elapsed_ms = (time.perf_counter() - start) * 1000.0
                
                # Record frame-level result
                frame_result = {
                    'frame_index': frame_index,
                    'timestamp': timestamp,
                    'face_bbox': face_info['bbox'],
                    'face_confidence': face_info['confidence'],
                    'prediction': detection_result['prediction'],
                    'raw_score': detection_result['raw_score'],
                    'calibrated_confidence': detection_result['calibrated_confidence'],
                    'processing_time_ms': round(elapsed_ms, 2),
                    'device_used': detection_result['device_used'],
                    'model_name': detection_result['details'].get('model', 'unknown'),
                    'model_version': detection_result['details'].get('model_version', 'unknown'),
                    'architecture': detection_result['details'].get('architecture', 'unknown'),
                    'face_crop_size': (w, h),
                    'face_crop_area_pct': (w * h) / (face_crop.shape[0] * face_crop.shape[1]) if face_crop.shape[0] > 0 else 0
                }
                
                results.append(frame_result)
                
            except Exception as exc:
                logger.warning(f"Failed to analyze face crop in frame {frame_index}: {exc}")
                results.append({
                    'frame_index': frame_index,
                    'timestamp': timestamp,
                    'face_bbox': face_info['bbox'],
                    'face_confidence': face_info['confidence'],
                    'prediction': 'error',
                    'raw_score': 0.0,
                    'calibrated_confidence': None,
                    'processing_time_ms': 0.0,
                    'device_used': 'cpu',
                    'model_name': 'error',
                    'model_version': 'error',
                    'error_details': str(exc)
                })
                
        return results

    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        return {
            "model_name": "Frame Analyzer",
            "model_version": "1.0.0",
            "is_available": self._image_detector.is_available if self._initialized else False,
            "depends_on": "Phase 3 image detection service",
            "device_support": ["cpu", "cuda"],
            "memory_footprint_mb": 20
        }