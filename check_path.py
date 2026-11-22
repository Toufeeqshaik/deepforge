import os

# Simple check of the file structure we created
paths = [
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

print("Checking file existence:")
all_exist = True
for path in paths:
    if os.path.exists(path):
        print(f"  ✅ {path}")
    else:
        print(f"  ❌ {path}")
        all_exist = False

if all_exist:
    print("\n✅ All files exist!")
else:
    print("\n❌ Some files are missing!")

# Check git status
print("\nChecking git status:")
os.system("cd /home/toufeeq/Downloads/deepforge && git status --short")