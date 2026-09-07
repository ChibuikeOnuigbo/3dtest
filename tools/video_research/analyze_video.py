#!/usr/bin/env python3
"""Create an evidence ledger from actual locally collected video metadata/captions.

The tool deliberately writes no invented scene observations. A source with missing
frames/captions stays explicitly blocked rather than gaining a speculative summary.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path

def main():
 p=argparse.ArgumentParser();p.add_argument('--index',type=Path,default=Path('research/videos/source_index.json'));p.add_argument('--output',type=Path,default=Path('research/video_analysis/videos.json'));a=p.parse_args(); idx=json.loads(a.index.read_text())
 observations=[]
 for source in idx['sources']:
  vid=source['id']; caption=list(Path('research/transcripts').glob(vid+'*.txt')); frames=list(Path('research/video_frames',vid).glob('*')) if Path('research/video_frames',vid).exists() else []
  observations.append({'video_id':vid,'source_url':source['url'],'collection_status':source['status'],'metadata_log':source.get('log'),'caption_files':[str(x) for x in caption],'selected_frame_files':[str(x) for x in frames],'observation_status':'awaiting_verified_media_review' if source['status'].startswith('metadata') else 'blocked_no_verified_media','observations':[]})
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps({'schema':'video-analysis-ledger/v1','policy':'No visual or gameplay observation is recorded without corresponding locally collected media or caption evidence.','videos':observations},indent=2)+'\n');print(f'{a.output}: {len(observations)} sources')
if __name__=='__main__': main()
