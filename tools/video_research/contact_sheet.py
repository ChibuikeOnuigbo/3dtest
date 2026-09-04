#!/usr/bin/env python3
"""Create a contact sheet only from already-permitted local selected frames.

Fails clearly when no actual frames exist; it never downloads video or generates stand-in
images. Pillow is intentionally required only when real frames are available.
"""
from __future__ import annotations
import argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--frames',type=Path,default=Path('research/video_frames'));p.add_argument('--output',type=Path,default=Path('research/video_analysis/contact_sheet.jpg'));a=p.parse_args()
frames=sorted([x for x in a.frames.rglob('*') if x.suffix.lower() in {'.png','.jpg','.jpeg','.webp'}])
if not frames: raise SystemExit('No verified local frames available; no contact sheet created.')
from PIL import Image, ImageDraw
thumbs=[]
for frame in frames:
 img=Image.open(frame).convert('RGB');img.thumbnail((320,180)); thumbs.append((frame,img.copy()))
columns=3;rows=(len(thumbs)+columns-1)//columns;sheet=Image.new('RGB',(columns*330,rows*215),(12,20,25));draw=ImageDraw.Draw(sheet)
for i,(path,img) in enumerate(thumbs):
 x=(i%columns)*330;y=(i//columns)*215;sheet.paste(img,(x,y));draw.text((x+5,y+185),path.name,fill=(225,240,240))
a.output.parent.mkdir(parents=True,exist_ok=True);sheet.save(a.output);print(a.output)
