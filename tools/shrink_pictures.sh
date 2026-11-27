#!/bin/sh
# tools/shrink_pictures.sh — make the light copies of the pictures the pages show
#
# The pictures in assets/ (pfp.png, heart.png) are big originals: over a
# megabyte each, for a square shown about 224px wide. For every
# assets/<name>.png this writes assets/<name>.jpg, 640px on its longer side,
# which is what index.html and lab.html actually load. It looks the same at
# that size and is around twenty times lighter.
#
# The .png files are the originals and are never changed.
#
# After replacing a picture (same name, new file), run this again:
#
#     sh tools/shrink_pictures.sh
#
# It also stamps the pages' links to each copy with a short code made from the
# copy's contents, so browsers fetch the new one instead of a remembered one.
# Needs macOS (it uses the built-in `sips`).

cd "$(dirname "$0")/.." || exit 1
SIDE=1024       # longest side of a copy, in pixels (sharp at 224px even on 3x screens and zoomed in)
QUALITY=92      # JPEG quality, 0-100

for png in assets/*.png; do
  [ -f "$png" ] || continue
  name=$(basename "$png" .png)
  jpg="assets/$name.jpg"

  width=$(sips -g pixelWidth "$png" | awk '/pixelWidth/ {print $2}')
  height=$(sips -g pixelHeight "$png" | awk '/pixelHeight/ {print $2}')
  longest=$width; [ "$height" -gt "$longest" ] && longest=$height

  if [ "$longest" -gt "$SIDE" ]; then
    sips -Z "$SIDE" -s format jpeg -s formatOptions "$QUALITY" "$png" --out "$jpg" >/dev/null || exit 1
  else                                   # already small: change the format only, never enlarge
    sips -s format jpeg -s formatOptions "$QUALITY" "$png" --out "$jpg" >/dev/null || exit 1
  fi

  code=$(shasum "$jpg" | cut -c1-8)
  for page in index.html lab.html; do
    [ -f "$page" ] && sed -i '' -E "s#(assets/$name\.jpg)(\?v=[0-9a-zA-Z]+)?#\1?v=$code#g" "$page"
  done

  echo "$jpg  $(stat -f %z "$jpg") bytes   (from $png, ${width}x${height}, $(stat -f %z "$png") bytes)"
done
