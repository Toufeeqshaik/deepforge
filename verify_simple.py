#!/usr/bin/env python3
import os

# Check if key files exist
files_to_check = [
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

print("Checking required files:")
all_good = True
for file_path in files_to_check:
    if os.path.exists(file_path):
        print(f"  ✅ {file_path}")
    else:
        print(f"  ❌ {file_path}")
        all_good = False

if all_good:
    print("\n✅ All required files found")
else:
    print("\n❌ Some files are missing")

# Check git status
print("\nChecking git status:")
try:
    result = os.popen("cd /home/toufeeq/Downloads/deepforge && git status --short").read().strip()
    if result:
        print("❌ Git status shows changes:")
        print(result)
    else:
        print("✅ Git working tree is clean")
except Exception as e:
    print(f"❌ Error checking git: {e}")