"""Video detection service orchestrator for DeepForge.

Manages the video detection pipeline:
1. Video loading and validation
2. Frame sampling
3. Face detection and extraction
4. Frame-level analysis using image detector
5. Temporal analysis
6. Result aggregation
"""

import time
import logging
from pathlib import Path
from typing import Literal, Dict, Any, Optional, List, Tuple
import cv2
import numpy as np

from app.core.config import settings
from app.core.exceptions import VideoValidationError, VideoNotFoundError
from app.detectors.video.base import VideoDetector, VideoDetectionResult, VideoDetectorResult
from app.detectors.video.video_loader import VideoLoader
from app.detectors.video.face_extractor import FaceExtractor
from app.detectors.video.frame_sampler import FrameSampler
from app.detectors.video.frame_analyzer import FrameAnalyzer

logger = logging.getLogger(__name__)

class VideoDetectionService(VideoDetector):
    """Orchestrates the video detection pipeline."""
    
    def __init__(self, 
                 image_detector_service,
                 face_extractor: FaceExtractor,
                 frame_sampler: FrameSampler,
                 temporal_analyzer: TemporalAnalyzer):
        """
        Initialize video detection service.
        
        Args:
            image_detector_service: The image detection service (from Phase 3)
            face_extractor: The face extractor for detecting faces in frames
            frame_sampler: The frame sampler for video processing
            temporal_analyzer: The temporal analyzer for evaluating consistency
        """
        self._image_detector = image_detector_service
        self._face_extractor = face_extractor
        self._frame_sampler = frame_sampler
        self._temporal_analyzer = temporal_analyzer
        self._initialized = False
        
        # Torch threading tuned for Core Ultra 7 (16 logical CPUs).
        try:
            import torch
            torch.set_num_threads(settings.TORCH_NUM_THREADS)
        except ImportError:
            pass

    def initialize(self) -> None:
        """Initialize all components. Call once at startup."""
        if self._initialized:
            return
            
        try:
            # Verify all components are available
            if not self._image_detector.is_available:
                logger.warning("Image detector not available for frame analysis")
                
            if not self._face_extractor.is_available:
                logger.warning("Face extractor not available")
                
            self._initialized = True
            logger.info("Video detection service initialized")
            
        except Exception as exc:
            logger.error(f"Failed to initialize video detection service: {exc}")
            raise

    def analyze_video(self, video_path: str) -> VideoDetectionResult:
        """
        Analyze a video file and return detection results.
        
        Args:
            video_path: Path to video file
            
        Returns:
            VideoDetectionResult with structured analysis results
        """
        result = VideoDetectionResult(
            status="completed",
            video_verdict="uncertain",
            confidence=None,
            model_name="DeepForge Video Detection Service",
            model_version="1.0.0",
            processing_time_ms=0.0,
            device_used="cpu",
            video_metadata={},
            frames_analyzed=0,
            faces_detected=0,
            frames_with_faces=0,
            frame_level_results=[],
            temporal_evidence=[],
            warnings=[],
            error_details=None
        )
        
        start_time = time.perf_counter()
        
        try:
            # 1. Validate video
            video_path_obj = Path(video_path)
            if not VideoLoader.validate_video_file(video_path_obj):
                raise VideoNotFoundError(f"Video file not found: {video_path}")
                
            if not VideoLoader.validate_video_size(video_path_obj):
                raise VideoValidationError(f"Video file too large: {video_path}")
                
            duration = VideoLoader.validate_video_duration(video_path_obj)
            if duration is None:
                raise VideoValidationError("Could not determine video duration")
                
            if duration < 1.0:  # Very short videos
                result["warnings"].append("Video is very short - may not contain sufficient frames")
                
            # 2. Open and initialize video capture
            self._frame_sampler.open_video(video_path_obj)
            if self._frame_sampler.get_total_frames() == 0:
                raise VideoValidationError("Could not read video frames")
                
            # 3. Sample frames
            frame_results = []
            frames_analyzed = 0
            faces_detected = 0
            frames_with_faces = 0
            
            # Get sampling parameters from configuration
            max_frames = self._frame_sampler.max_frames
            interval_sec = self._frame_sampler.sampling_interval_sec
            
            # Sample frames
            current_pos = 0
            frame_count = 0
            
            while frame_count < self._frame_sampler.get_frame_count() and frame_count < max_frames:
                frame_index = frame_count
                timestamp = frame_count / self._frame_sampler.get_fps() if self._frame_sampler.get_fps() > 0 else frame_count
                
                frame = self._frame_sampler.get_next_frame(frame_count)
                if frame is None:
                    break
                    
                frame_count += 1
                frame_results = self._analyze_frame(frame, frame_index, timestamp)
                
                # Accumulate results
                frame_results.extend(frame_results)
                frames_analyzed += 1
                
                # Count faces detected
                face_count = len([r for r in frame_results if 'face_bbox' in r])
                faces_detected += face_count
                frames_with_faces += 1 if face_count > 0 else 0
                
                # Store frame results for temporal analysis
                self._temporal_analyzer.add_frame_results(frame_results)
                
            # 4. Temporal analysis
            temporal_result = self._temporal_analyzer.analyze()
            result.update(temporal_result)
            result["processing_time_ms"] = int((time.perf_counter() - start_time) * 1000)
            
            # 5. Final verdict based on temporal analysis
            if result["status"] == "completed":
                if result["video_verdict"] == "uncertain" and result["confidence"] is not None:
                    if result["confidence"] >= 0.85:
                        result["video_verdict"] = "potentially_manipulated"
                        result["confidence"] = result["confidence"]
                    elif result["confidence"] >= 0.70:
                        result["video_verdict"] = "likely_authentic"
                        result["confidence"] = result["confidence"]
                elif result["status"] == "insufficient_evidence":
                    result["video_verdict"] = "insufficient_evidence"
                    result["confidence"] = None
                    
            return result
            
        except VideoValidationError as e:
            result["status"] = "incomplete"
            result["video_verdict"] = "uncertain"
            result["confidence"] = None
            result["warnings"] = [str(e)]
            result["error_details"] = str(e)
            result["processing_time_ms"] = int((time.perf_counter() - start_time) * 1000)
            return result
            
        except VideoNotFoundError as e:
            result["status"] = "incomplete"
            result["video_verdict"] = "uncertain"
            result["confidence"] = None
            result["warnings"] = [str(e)]
            result["error_details"] = str(e)
            result["processing_time_ms"] = int((time.perf_counter() - start_time) * 1000)
            return result
            
        except Exception as e:
            result["status"] = "incomplete"
            result["video_verdict"] = "uncertain"
            result["confidence"] = None
            result["warnings"] = ["Unexpected error during video analysis"]
            result["error_details"] = str(e)
            result["processing_time_ms"] = int((time.perf_counter() - start_time) * 1000)
            return result

    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata."""
        return {
            "model_name": "DeepForge Video Detection Service",
            "model_version": "1.0.0",
            "is_available": self._initialized,
            "dependencies": [
                "ImageDetectionService",
                "FaceExtractor",
                "FrameSampler",
                "TemporalAnalyzer"
            ],
            "device_support": ["cpu", "cuda"],
            "memory_footprint_mb": 100,
            "description": "Modular video detection pipeline with frame sampling and temporal analysis"
        }