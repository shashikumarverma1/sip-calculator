#!/usr/bin/env bash
# Usage: scripts/ios-screenshot.sh <name>
# Captures the booted simulator to store-screenshots/ios/<name>.png and checks the 6.9" size.
set -euo pipefail
name="${1:?usage: $0 <name>}"
dir="$(cd "$(dirname "$0")/.." && pwd)/store-screenshots/ios"
mkdir -p "$dir"
out="$dir/$name.png"
xcrun simctl io booted screenshot --type=png "$out" >/dev/null
w=$(sips -g pixelWidth "$out" | awk '/pixelWidth/{print $2}')
h=$(sips -g pixelHeight "$out" | awk '/pixelHeight/{print $2}')
if [[ "$w" == 1320 && "$h" == 2868 ]]; then
  echo "OK   $out (${w}x${h})"
else
  echo "WARN $out is ${w}x${h}, expected 1320x2868" >&2
  exit 1
fi
