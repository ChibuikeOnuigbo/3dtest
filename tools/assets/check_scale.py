#!/usr/bin/env python3
"""Reserve scale validation for inspected model bounds; never claims unknown dimensions are valid."""
import json
print(json.dumps({'status':'UNVERIFIED','reason':'Bounding-box extraction requires parseable POSITION buffers. Run inspect_model first and compare dimensions to declared player/room scale.'},indent=2))
