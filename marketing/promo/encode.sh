#!/usr/bin/env bash
# Synthesize the 120 BPM placeholder beat and encode frames + audio to MP4.
set -euo pipefail
D="${1:-marketing/promo}"
K='0.9*sin(2*PI*(45+110*exp(-28*mod(t,0.5)))*mod(t,0.5))*exp(-7*mod(t,0.5))*lt(t,18)'
H() { echo "0.18*(random($1)*2-1)*exp(-70*mod(t-0.25,0.5))*gt(t,2.5)*lt(t,18)"; }
E='0.25*sin(2*PI*55*t)*exp(-1.2*(t-18))*gte(t,18)'
ffmpeg -y -f lavfi -i "aevalsrc='$K+$(H 0)+$E|$K+$(H 1)+$E':s=44100:d=21" -af "afade=t=out:st=19.5:d=1.5,alimiter=limit=0.9" "$D/beat.wav"
ffmpeg -y -framerate 30 -i "$D/frames/f%04d.jpg" -i "$D/beat.wav" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -movflags +faststart -c:a aac -b:a 160k -shortest marketing/spotter-promo-9x16.mp4
