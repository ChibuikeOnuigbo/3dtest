#!/usr/bin/env python3
import subprocess, sys
raise SystemExit(subprocess.call([sys.executable, 'tools/animation_tools/inspect_animation.py', *sys.argv[1:]]))
