#!/bin/sh
set -eu

ROOT="${1:-/app/public/videos}"
FPS="${FPS:-15}"
WIDTH="${WIDTH:-480}"
CRF="${CRF:-28}"

count=0
kept=0
before_total=0
after_total=0

list_file="$(mktemp)"
find "$ROOT" -type f -name '*.mp4' > "$list_file"

while IFS= read -r file; do
  tmp="${file}.tmp.mp4"
  before=$(stat -c%s "$file")

  ffmpeg -hide_banner -loglevel error -y \
    -i "$file" \
    -vf "fps=${FPS},scale=${WIDTH}:-2" \
    -c:v libx264 \
    -profile:v baseline \
    -pix_fmt yuv420p \
    -preset veryfast \
    -crf "$CRF" \
    -an \
    -movflags +faststart \
    "$tmp"

  after=$(stat -c%s "$tmp")

  count=$((count + 1))
  before_total=$((before_total + before))

  if [ "$after" -lt "$before" ]; then
    mv "$tmp" "$file"
    after_total=$((after_total + after))
    echo "$count optimized $file $before -> $after"
  else
    rm -f "$tmp"
    kept=$((kept + 1))
    after_total=$((after_total + before))
    echo "$count kept $file $before -> $after"
  fi
done < "$list_file"

rm -f "$list_file"

echo "Done. Checked $count files, kept $kept originals: $before_total -> $after_total bytes"
