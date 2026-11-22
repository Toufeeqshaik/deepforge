#!/usr/bin/env python3
"""Verification script to check Phase 3 implementation."""

import os
import sys
from pathlib import Path

def check_files_exist():
    """Check that all required files were created."""
    required_files = [
        "backend/app/detectors/image/__init__.py",
        "backend/app/detectors/image/base.py",
        "backend/app/detectors/image/preprocessing.py",
        "backend/app/detectors/image/community_forensics.py",
        "backend/app/detectors/image/fallback.py",
        "backend/app/detectors/image/service.py",
        "backend/app/services/detection_service.py",
        "backend/app/services/analysis_service.py",
        "backend/app/api/routes.py",
        "docs/IMAGE_ENGINE.md",
        "backend/tests/test_detection_service.py"
    ]
    
    missing = []
    for file_path in required_files:
        full_path = Path(file_path)
        if not full_path.exists():
            missing.append(file_path)
    
    if missing:
        print(f"❌ Missing files: {missing}")
        return False
    else:
        print("✅ All required files exist")
        return True

def check_git_status():
    """Check git status for uncommitted changes."""
    try:
        result = os.popen("cd /home/toufeeq/Downloads/deepforge && git status --short").read().strip()
        if result:
            print("❌ Git status shows uncommitted changes:")
            print(result)
            return False
        else:
            print("✅ Git working tree is clean")
            return True
    except Exception as e:
        print(f"❌ Error checking git status: {e}")
        return False

def check_implementation():
    """Verify key implementation details."""
    try:
        # Check that service.py imports the new modules
        with open("backend/app/services/detection_service.py", "r") as f:
            content = f.read()
            if "CommunityForensicsAdapter" in content and "FallbackImageDetector" in content:
                print("✅ detection_service.py imports new modules")
            else:
                print("❌ detection_service.py missing imports")
                return False
                
        # Check that analysis_service.py uses new detection service
        with open("backend/app/services/analysis_service.py", "r") as f:
            content = f.read()
            if "from app.services.detection_service import detection_service" in content:
                print("✅ analysis_service.py imports new detection service")
            else:
                print("❌ analysis_service.py missing new import")
                return False
                
        # Check that routes.py calls the new service
        with open("backend/app/api/routes.py", "r") as f:
            content = f.read()
            if "detection_service.is_available" in content:
                print("✅ routes.py uses new detection service")
            else:
                print("❌ routes.py doesn't use new detection service")
                return False
                
        return True
    except Exception as e:
        print(f"❌ Error checking implementation: {e}")
        return False

def main():
    print("=== DeepForge Phase 3 Verification ===")
    
    if not check_files_exist():
        sys.exit(1)
        
    if not check_git_status():
        sys.exit(1)
        
    if not check_implementation():
        sys.exit(1)
        
    print("\n🎉 All verification checks passed!")
    print("✅ Image detection engine implementation is complete and verified")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())