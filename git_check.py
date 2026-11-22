#!/usr/bin/env python3
import os

try:
    os.system("cd /home/toufeeq/Downloads/deepforge && git status --short")
except Exception as e:
    print(f"Error: {e}")