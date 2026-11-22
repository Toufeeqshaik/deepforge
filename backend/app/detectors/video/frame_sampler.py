"""Frame sampling utilities for video detection."""

import time
import logging
from pathlib import Path
from typing import Literal, List, Tuple, Optional
import cv2
import numpy as np

logger = logging.getLogger(__name__)

class FrameSampler:
    """Handle video frame sampling with configurable parameters."""
    
    def __init__(self, 
                 max_frames: int = 16, 
                 sampling_interval_sec: float = 1.0,
                 resize_width: Optional[int] = 224,
                 resize_height: Optional[int] = 224):
        """
        Initialize frame sampler with configuration.
        
        Args:
            max_frames: Maximum number of frames to sample from video
            sampling_interval_sec: Interval in seconds between sampled frames
            resize_width: Width to resize frames to (None for original size)
            resize_height: Height to resize frames to (None for original size)
        """
        self.max_frames = max_frames
        self.sampling_interval_sec = sampling_interval_sec
        self.resize_width = resize_width
        self.resize_height = resize_height
        self._video_capture = None
        self._total_frames = 0
        self._fps = 0.0
        
        # Torch threading tuned for Core Ultra 7 (16 logical CPUs).
        try:
            import torch
            torch.set_num_threads(8)
        except ImportError:
            pass

    def open_video(self, video_path: Path) -> bool:
        """Open video file and initialize capture properties."""
        try:
            self._video_capture = cv2.VideoCapture(str(video_path))
            if not self._video_capture.isOpened():
                logger.error(f"Failed to open video: {video_path}")
                return False
                
            self._total_frames = int(self._video_capture.get(cv2.CAP_PROP_FRAME_COUNT))
            self._fps = self._video_capture.get(cv2.CAP_PROP_FPS)
            
            if self._fps <= 0:
                self._fps = 1.0  # Default to 1 FPS if invalid
                
            logger.info(f"Opened video {video_path}: {self._total_frames} frames, {self._fps:.2f} FPS")
            return True
            
    def close(self) -> None:
        """Close video capture."""
        if self._video_capture is not None:
            self._video_capture.release()
            self._video_capture = None
            
    def get_total_frames(self) -> int:
        """Get total number of frames in video."""
        return self._total_frames if self._video_capture else 0
        
    def get_fps(self) -> float:
        """Get frames per second."""
        return self._fps if self._video_capture else 0.0
        
    def get_frame_count(self) -> int:
        """Get number of frames that can be sampled given constraints."""
        if not self._video_capture:
            return 0
            
        max_frames = self.max_frames
        interval_frames = int(self.sampling_interval_sec * self._fps)
        if interval_frames <= 0:
            interval_frames = 1
            
        # Calculate maximum number of frames we can sample
        max_possible_frames = max_frames * interval_frames
        total_frames = self._total_frames
        
        # Calculate how many frames we can actually sample
        # We need to sample at positions: 0, interval, 2*interval, ...
        # So max index we can reach is: start + (n-1)*interval < total_frames
        # So n <= (total_frames - start) / interval + 1
        # For start=0: n <= total_frames / interval + 1
        max_sampleable = max_possible_frames
        if total_frames > 0:
            # Calculate actual number of frames we can sample
            # We sample at positions: 0, interval, 2*interval, ...
            # Last valid position: k*interval < total_frames
            # So k < total_frames/interval
            # Max k is floor((total_frames - 1) / interval)
            # Total samples = k + 1
            max_k = (total_frames - 1) // interval_frames
            actual_max_frames = min(max_sampleable, max_k + 1)
        else:
            actual_max_frames = 0
            
        return actual_max_frames
        
    def get_next_frame(self, current_pos: int) -> Optional[np.ndarray]:
        """Get next frame to sample at position 'current_pos'."""
        if not self._video_capture:
            return None
            
        # Set the frame position
        self._video_capture.set(cv2.CAP_PROP_POS_FRAMES, current_pos)
        
        ret, frame = self._video_capture.read()
        if not ret:
            return None
            
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Resize if needed
        if self.resize_width or self.resize_height:
            frame_resized = cv2.resize(frame_rgb, 
                                      (self.resize_width or frame_rgb.shape[1], 
                                       self.resize_height or frame_rgb.shape[0]),
             interpolation=cv2.INTER_AREA)
        else:
            frame_resized = frame_rgb
            
        return frame_resized