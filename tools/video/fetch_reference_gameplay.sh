#!/usr/bin/env bash
# Reference gameplay acquisition (runs in GitHub Actions — YouTube media is unreachable from the dev sandbox).
#
#   tools/video/fetch_reference_gameplay.sh <out_dir>
#
# For each game named in research/videos/reference_games.txt the search term is
#   "<game> 15min gameplay no commentary"           (user requirement: exact suffix)
# Rule set (user requirement): keep only ~15–20 min uploads; when the first page of results
# only has longplays, cut a 15-minute part with --download-sections. Nothing longer is stored.
# Each clip is capped at 360p so the repository stays small; frames are extracted for study.
set -uo pipefail
OUT="${1:-research/videos/clips}"
LIST="research/videos/reference_games.txt"
mkdir -p "$OUT"
INDEX="$OUT/index.json"
echo '[' > "$INDEX"
first=1
json() { python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'; }
while IFS= read -r game; do
  [ -z "$game" ] && continue
  slug=$(echo "$game" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//')
  query="ytsearch10:${game} 15min gameplay no commentary"
  echo "== $game"
  # 1) whole upload between 13 and 22 minutes
  yt-dlp "$query" --match-filter "duration>=780 & duration<=1320" --max-downloads 1 \
    --no-playlist --format "bv*[height<=360]+ba/b[height<=360]" --merge-output-format mp4 \
    --output "$OUT/${slug}.%(ext)s" --print-to-file "%(id)s|%(title)s|%(duration)s|%(webpage_url)s" "$OUT/${slug}.meta" \
    --quiet --no-warnings || true
  mode="whole-upload"
  if [ ! -f "$OUT/${slug}.mp4" ]; then
    # 2) fallback: first 15 minutes of the best matching longer upload
    mode="15min-section"
    yt-dlp "$query" --match-filter "duration>=1320" --max-downloads 1 --download-sections "*0:00-15:00" \
      --no-playlist --format "bv*[height<=360]+ba/b[height<=360]" --merge-output-format mp4 \
      --output "$OUT/${slug}.%(ext)s" --print-to-file "%(id)s|%(title)s|%(duration)s|%(webpage_url)s" "$OUT/${slug}.meta" \
      --quiet --no-warnings || true
  fi
  [ $first -eq 0 ] && echo ',' >> "$INDEX"; first=0
  if [ -f "$OUT/${slug}.mp4" ]; then
    mkdir -p "$OUT/${slug}-frames"
    ffmpeg -loglevel error -i "$OUT/${slug}.mp4" -vf "fps=1/60,scale=640:-1" "$OUT/${slug}-frames/f%03d.jpg" || true
    meta=$(head -n1 "$OUT/${slug}.meta" 2>/dev/null || echo "|||")
    IFS='|' read -r vid title dur url <<< "$meta"
    printf '{"game":%s,"slug":"%s","mode":"%s","video_id":"%s","title":%s,"duration_s":%s,"url":"%s","file":"%s.mp4","frames_dir":"%s-frames"}' \
      "$(printf '%s' "$game" | json)" "$slug" "$mode" "$vid" "$(printf '%s' "$title" | json)" "${dur:-null}" "$url" "$slug" "$slug" >> "$INDEX"
    echo "   ok ($mode): $title [$dur s]"
  else
    printf '{"game":%s,"slug":"%s","mode":"failed","error":"no upload matched duration rules or download blocked"}' "$(printf '%s' "$game" | json)" "$slug" >> "$INDEX"
    echo "   FAILED: no matching upload"
  fi
done < "$LIST"
echo ']' >> "$INDEX"
python3 -m json.tool "$INDEX" > /dev/null && echo "index ok: $INDEX"
