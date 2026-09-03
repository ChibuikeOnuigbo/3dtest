#!/usr/bin/env python3
"""Validate a GLB header; does not execute or import model content."""
from __future__ import annotations
import argparse, pathlib, struct, sys
p=argparse.ArgumentParser(); p.add_argument("file"); a=p.parse_args(); path=pathlib.Path(a.file)
data=path.read_bytes()[:12]
if len(data)!=12 or data[:4] != b'glTF': print("INVALID_GLB: missing glTF magic", file=sys.stderr); raise SystemExit(1)
version,length=struct.unpack('<II',data[4:]); actual=path.stat().st_size
print({"file":str(path),"version":version,"declared_length":length,"actual_length":actual,"valid":version==2 and length==actual})
raise SystemExit(0 if version==2 and length==actual else 1)
