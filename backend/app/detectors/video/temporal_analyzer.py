"""Temporal analysis utilities for video detection.

Evaluates consistency and temporal signals across sampled frames.
"""

import time
import logging
from typing import List, Dict, Any, Optional
from collections import deque
import numpy as np

from app.core.config import settings
from app.core.exceptions import VideoValidationError

logger = logging.getLogger(__name__)

class TemporalAnalyzer:
    """Analyze temporal consistency across video frames."""
    
    def __init__(self, 
                 min_frames_for_analysis: int = 5,
                 similarity_threshold: float = 0.7,
                 max_velocity: float = 5.0):
        """
        Initialize temporal analyzer.
        
        Args:
            min_frames_for_analysis: Minimum frames needed for meaningful analysis
            similarity_threshold: Minimum similarity score for valid frame comparisons
            max_velocity: Maximum allowed positional velocity (pixels per frame)
        """
        self.min_frames_for_analysis = min_frames_for_analysis
        self.similarity_threshold = similarity_threshold
        self.max_velocity = max_velocity
        
        # Store frame-level results for temporal analysis
        self._frame_results = []  # List of frame-level analysis results
        self._initialized = False
        
        # Torch threading tuned for Core Ultra 7 (16 logical CPUs).
        try:
            import torch
            torch.set_num_threads(settings.TORCH_NUM_THREADS)
        except ImportError:
            pass

    def add_frame_results(self, frame_results: list) -> None:
        """Add frame-level analysis results for temporal evaluation."""
        self._frame_results.extend(frame_results)
        
    def analyze(self) -> Dict[str, Any]:
        """Perform temporal analysis on collected frame results."""
        if len(self._frame_results) < self.min_frames_for_analysis:
            return {
                "status": "insufficient_evidence",
                "video_verdict": "uncertain",
                "confidence": None,
                "reason": f"Collected {len(self._frame_results)} frames, need at least {self.min_frames_for_analysis}"
            }
            
        # Sort by timestamp to ensure chronological order
        sorted_results = sorted(self._frame_results, key=lambda x: x['timestamp'])
        
        # Extract relevant data for analysis
        frame_predictions = [r['prediction'] for r in sorted_results if 'prediction' in r]
        frame_timestamps = [r['timestamp'] for r in sorted_results]
        frame_bboxes = [r['face_bbox'] for r in sorted_results if 'face_bbox' in r]
        frame_timestamps_with_faces = [r['timestamp'] for r in sorted_results if 'face_bbox' in r]
        
        # Check if we have enough valid frames with face detections
        valid_frames = [r for r in sorted_results if 'prediction' in r and 'face_bbox' in r]
        if len(valid_frames) < self.min_frames_for_analysis:
            return {
                "status": "insufficient_evidence",
                "video_verdict": "uncertain",
                "confidence": None,
                "reason": f"Only {len(valid_frames)} frames with valid face detections out of {len(sorted_results)}"
            }
            
        # Temporal consistency analysis
        temporal_signals = []
        
        # Check frame-to-frame prediction consistency
        for i in range(1, len(valid_frames)):
            prev = valid_frames[i-1]
            curr = valid_frames[i]
            
            # Prediction consistency
            if prev['prediction'] != curr['prediction']:
                temporal_signals.append({
                    'type': 'prediction_change',
                    'frames': (prev['frame_index'], curr['frame_index']),
                    'details': f"Prediction changed from {prev['prediction']} to {curr['prediction']}"
                })
                
            # Positional consistency (face position)
            if 'face_bbox' in prev and 'face_bbox' in curr:
                prev_bbox = prev['face_bbox']
                curr_bbox = curr['face_bbox']
                
                # Calculate Euclidean distance between face centers
                prev_center = ((prev_bbox[0] + prev_bbox[2] / 2), (prev_bbox[1] + prev_bbox[3] / 2))
                curr_center = ((curr_bbox[0] + curr_bbox[2] / 2), (curr_bbox[1] + curr_bbox[3] / 2))
                
                distance = ((prev_center[0] - curr_center[0])**2 + (prev_center[1] - curr_center[1])**2) ** 0.5
                velocity = distance / (curr['timestamp'] - prev['timestamp']) if curr['timestamp'] > prev['timestamp'] else 0
                
                if distance > 10:  # Arbitrary threshold
                    temporal_signals.append({
                        'type': 'position_shift',
                        'frames': (prev['frame_index'], curr['frame_index']),
                        'distance_pixels': distance,
                        'velocity_pixels_per_sec': velocity,
                        'details': f"Face position shifted {distance:.1f} pixels"
                    })
                    
        # Synthesize temporal evidence
        temporal_evidence = []
        if temporal_signals:
            temporal_evidence.extend([
                f"Temporal inconsistency detected: {len(temporal_signals)} signals",
                f"Max velocity: {max(s['velocity_pixels_per_sec'] for s in temporal_signals) if temporal_signals else 0:.1f} px/s"
            )
            
        # Final analysis
        frame_count = len(valid_frames)
        prediction_consistency = "high" if len(set(r['prediction'] for r in valid_frames)) <= 1 else "low"
        confidence_score = 0.0
        
        if frame_count >= 10 and frame_count <= 20:
            confidence_score = 0.6
        elif frame_count > 20:
            confidence_score = 0.8
            
        result = {
            "status": "completed" if frame_count >= self.min_frames_for_analysis else "insufficient_evidence",
            "video_verdict": "potentially_manipulated" if frame_count >= self.min_frames_for_analysis and frame_count < 10 else "uncertain",
            "confidence": confidence_score,
            "model_name": "Temporal Analyzer",
            "model_version": "1.0.0",
            "processing_time_ms": 0.0,  # Will be set externally
            "device_used": "cpu",
            "video_metadata": {
                "total_frames": len(sorted_results),
                "valid_frames_with_faces": len(valid_frames),
                "frames_analyzed": len(valid_frames)
            },
            "temporal_evidence": temporal_evidence,
            "warnings": [],
            "error_details": None
        }
        
        # Add confidence based on frame count and consistency
        if frame_count >= 20:
            confidence_score = 0.8
        elif frame_count >= 10:
            confidence_score = 0.5
            
        result["confidence"] = confidence_score
        result["processing_time_ms"] = 0.0  # Will be set by caller
        
        return result