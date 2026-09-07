#!/usr/bin/env python3
"""Read-only Playwright readiness diagnostic; it never installs or downloads a browser."""
from __future__ import annotations
import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHANNELS = ('chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'microsoft-edge', 'microsoft-edge-stable')
CACHE_PATHS = (Path('/ms-playwright'), Path.home() / '.cache/ms-playwright', ROOT / 'node_modules/playwright-core/.local-browsers')

def output(command):
    try:
        return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=30, check=False)
    except OSError as error:
        return type('Result', (), {'returncode': None, 'stdout': '', 'stderr': str(error)})()

def main():
    node = output(['node', '--version'])
    package = output(['node', '-e', "for (const p of ['playwright','playwright-core']) { try { const x=require(p+'/package.json'); console.log(p+'@'+x.version) } catch { console.log(p+': absent') } }"])
    binaries = {channel: shutil.which(channel) for channel in CHANNELS if shutil.which(channel)}
    cache = [str(path) for path in CACHE_PATHS if path.exists()]
    report = {
        'status': 'READY_TO_LAUNCH' if binaries else 'BLOCKED_NO_BROWSER_BINARY',
        'project_root': str(ROOT),
        'node': {'returncode': node.returncode, 'version': node.stdout.strip(), 'error': node.stderr.strip()},
        'playwright_packages': package.stdout.strip().splitlines(),
        'browser_executables': binaries,
        'browser_cache_paths': cache,
        'launch_flags_when_binary_exists': ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless=new'],
        'network_policy': 'No browser download is attempted by this diagnostic. It does not change TLS verification or use mirrors.'
    }
    print(json.dumps(report, indent=2))

if __name__ == '__main__': main()
