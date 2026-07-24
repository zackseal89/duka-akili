#!/bin/bash
set -e

DIR="/c/Users/HP/Desktop/gdg gemma/demo-video"
REMOTION="$DIR/motion/renders/draft.mp4"
REC_A="$DIR/export-1784707541034.mp4"
REC_B="$DIR/the centerpiece (most important).mp4"
OUT="$DIR/final_v1.mp4"

# Remotion scene content fades to fully invisible a bit before its frame budget
# ends (groupOpacity windows were sized with margin). Trimming each scene to
# its actual content-visible range -- not the full scene duration -- removes
# the dead flat-color holds that were baked into the single 60s draft render.
ffmpeg -y \
  -i "$REMOTION" \
  -i "$REC_A" \
  -i "$REC_B" \
  -filter_complex "
    [0:v]trim=start=0:end=13.7,setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.5,format=yuv420p[coldopen];
    [0:v]trim=start=15:end=31,setpts=PTS-STARTPTS,format=yuv420p[problem];
    [0:v]trim=start=31:end=56,setpts=PTS-STARTPTS,format=yuv420p[whygemma];
    [0:v]trim=start=56:end=69.33,setpts=PTS-STARTPTS,fade=t=out:st=12.8:d=0.4,format=yuv420p[outro];
    [1:v]trim=start=0:end=14,setpts=PTS-STARTPTS,fps=30,format=yuv420p[tour];
    [1:v]trim=start=97:end=120,setpts=PTS-STARTPTS,fps=30,format=yuv420p[sug];
    [1:v]trim=start=178:end=193,setpts=PTS-STARTPTS,fps=30,format=yuv420p[upload];
    [1:v]trim=start=195:end=225,setpts=PTS-STARTPTS,fps=30,format=yuv420p[qa];
    [2:v]trim=start=0:end=7,setpts=PTS-STARTPTS,fps=30,format=yuv420p[cpa];
    [2:v]trim=start=7:end=20,setpts=(PTS-STARTPTS)/3,fps=30,format=yuv420p[cpb];
    [2:v]trim=start=20:end=35,setpts=PTS-STARTPTS,fps=30,format=yuv420p[cpc];
    [coldopen][problem][tour][cpa][cpb][cpc][sug][upload][qa][whygemma][outro]concat=n=11:v=1:a=0[outv]
  " \
  -map "[outv]" \
  -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
  "$OUT"

ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=0 "$OUT"
