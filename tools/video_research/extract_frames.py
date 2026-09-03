#!/usr/bin/env python3
"""Extract a few opening frames from a temporary low-res clip, then delete the video.
This deliberately does not archive reference videos."""
from __future__ import annotations
import argparse, pathlib, shutil, subprocess, tempfile

def main() -> int:
    p=argparse.ArgumentParser(); p.add_argument("url"); p.add_argument("--id",required=True); p.add_argument("--output",default="research/video_frames"); a=p.parse_args()
    output=pathlib.Path(a.output)/a.id; output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="video-research-") as temp:
        tmp=pathlib.Path(temp)/"clip.%(ext)s"
        # Sample only the opening 24 seconds in a low-quality stream; yt-dlp may reject protected/stream-only video.
        cmd=["yt-dlp","--no-warnings","--download-sections","*0:00-0:24","-f","worst[height<=360]/worst","-o",str(tmp),a.url]
        result=subprocess.run(cmd,text=True,capture_output=True)
        (output/"frame-extraction.log").write_text((result.stdout+"\n"+result.stderr)[-8000:])
        clips=list(pathlib.Path(temp).glob("clip.*"))
        if result.returncode or not clips or shutil.which("ffmpeg") is None:
            return 1
        clip=clips[0]
        for seconds,label in ((2,"opening"),(10,"early-space"),(20,"early-action")):
            destination=output/f"{label}-{seconds:02d}s.jpg"
            frame=subprocess.run(["ffmpeg","-y","-ss",str(seconds),"-i",str(clip),"-frames:v","1","-q:v","3",str(destination)],text=True,capture_output=True)
            if frame.returncode: return 1
    print(output); return 0
if __name__ == "__main__": raise SystemExit(main())
