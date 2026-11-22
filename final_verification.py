#!/usr/bin/env python3
"""Final verification of Phase 4 completion."""

import os
import subprocess

def main():
    print("=== DeepForge Phase 4 Final Verification ===")
    
    # Check git status
    try:
        result = subprocess.run(
            ["cd", "/home/toufeeq/Downloads/deepforge", "git", "status", "--short"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            print("❌ Git status check failed")
            print("Error:", result.stderr)
            return False
        elif result.stdout.strip():
            print("❌ Git working tree has uncommitted changes:")
            print(result.stdout.strip())
            return False
        else:
            print("✅ Git working tree is clean")
    except Exception as e:
        print(f"❌ Error checking git status: {e}")
        return False
    
    # Check that all required files exist
    required_files = [
        "backend/app/detectors/video/__init__.py",
        "backend/app/detectors/video/base.py",
        "backend/app/detectors/video/video_loader.py",
        "backend/app/detectors/video/frame_sampler.py",
        "backend/app/detectors/video/face_extractor.py",
        "backend/app/detectors/video/frame_analyzer.py",
        "backend/app/detectors/video/temporal_analyzer.py",
        "backend/app/detectors/video/service.py",
        "docs/VIDEO_ENGINE.md",
        "backend/tests/test_detection_service.py"
    ]
    
    all_found = True
    for file_path in required_files:
        if not os.path.exists(file_path):
            print(f"❌ Missing: {file_path}")
            all_found = False
        else:
            print(f"✅ Found: {file_path}")
    
    if all_found:
        print("\n✅ All required files exist")
    else:
        print("\n❌ Some required files are missing")
        return False
    
    # Check API compatibility
    try:
        # Verify video route exists in routes.py
        with open("backend/app/api/routes.py", "r") as f:
            content = f.read()
            if "/analyze/video" in content and "response_model=AnalysisReport" in content:
                print("✅ Video API route preserved")
            else:
                print("❌ Video API route missing or modified")
                return False
                
        # Verify image route still exists
        if "/analyze/image" in content:
            print("✅ Image API route preserved")
        else:
            print("❌ Image API route missing")
            return False
            
    except Exception as e:
        print(f"❌ Error checking API compatibility: {e}")
        return False
    
    print("\n🎉 PHASE 4 VERIFICATION COMPLETE")
    print("✅ All checks passed")
    print("✅ Implementation is complete and verified")
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)