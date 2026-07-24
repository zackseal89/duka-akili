#!/bin/bash
set -e

VO="/c/Users/HP/Desktop/gdg gemma/demo-video/voiceover"
OUT="/c/Users/HP/Desktop/gdg gemma/demo-video"
SLOTS="$OUT/audio_slots"
mkdir -p "$SLOTS"

# Each narration clip is padded with trailing silence to exactly match its
# scene's video-slot duration, in the same order the video segments are
# concatenated. That guarantees sync without any timestamp math: audio slot
# N and video segment N always start together because both lists sum to the
# same running total by construction.
pad () {
  local in="$1" dur="$2" out="$3"
  ffmpeg -y -i "$in" -af "apad=whole_dur=$dur" -ar 24000 -ac 1 "$out" 2>&1 | tail -3
}

pad "$VO/01_coldopen.wav"    13.7  "$SLOTS/01.wav"
pad "$VO/02_problem.wav"     16.0  "$SLOTS/02.wav"
pad "$VO/03_tour.wav"        14.0  "$SLOTS/03.wav"

# Centerpiece: the script calls for a few seconds of silence before "Watch
# what it does next" so the real reasoning UI gets read first -- 3s lead-in,
# then the line, padded to the full 26.33s slot.
ffmpeg -y -i "$VO/04_centerpiece.wav" -af "adelay=3000|3000,apad=whole_dur=26.33" -ar 24000 -ac 1 "$SLOTS/04.wav" 2>&1 | tail -3

pad "$VO/05_sugarcane.wav"   23.0  "$SLOTS/05.wav"
pad "$VO/06_upload.wav"      15.0  "$SLOTS/06.wav"
pad "$VO/07_qa.wav"          30.0  "$SLOTS/07.wav"
pad "$VO/08_whygemma.wav"    25.0  "$SLOTS/08.wav"
pad "$VO/09_outro.wav"       13.33 "$SLOTS/09.wav"

ffmpeg -y \
  -i "$SLOTS/01.wav" -i "$SLOTS/02.wav" -i "$SLOTS/03.wav" -i "$SLOTS/04.wav" \
  -i "$SLOTS/05.wav" -i "$SLOTS/06.wav" -i "$SLOTS/07.wav" -i "$SLOTS/08.wav" -i "$SLOTS/09.wav" \
  -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a]concat=n=9:v=0:a=1[outa]" \
  -map "[outa]" "$OUT/narration.wav"

ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=0 "$OUT/narration.wav"
