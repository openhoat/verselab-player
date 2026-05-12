# Roland Verselab MV-1 — Parameter Guide

Firmware v1.80 | ZEN-Core Sound Engine

---

## Project Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| TRANSPOS | -5–+6 | Transpose the overall pitch in semitones |
| TEMPO | 5.0–300.0 | Project tempo (BPM) |
| METRO SW | OFF, ON | Metronome on/off |
| METRO VOL | 0–10 | Metronome volume |
| PC Level | 0–127 | USB PC IN port input level |
| PC Pan | L128–127R | USB PC IN port pan |

### Pad Colors (COLOR)

| Parameter | Values | Description |
|-----------|--------|-------------|
| Note | ORANGE, YELLOW, GREEN, BLUE, PURPLE, PINK, WHITE | Pad color in Note mode |
| Play | (same) | Clip playing back in Section Select |
| Stay | (same + P.BLUE, L.ORANGE, L.YELLOW, L.GREEN, P.GREEN, L.SKYBLUE, L.BLUE, L.PURPLE) | Clip staying |
| D.Style | (same) | Drum track in Style mode |
| M.Style | (same) | Melodic track in Style mode |

## Song Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| KEY | C–B | Song key |
| SCALE | MAJ, min, Dor, Phry, Lyd, Mix, Loc, Pnt, b5Pnt, mPnt, Gypsy, SpnSc, Blu, Chrm | Song scale |
| SWING | -100–+100 | Swing amount |
| METRO | OFF, ON | Metronone per song |

### Section Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| MEAS | 1–32 | Number of measures in the section |
| PLAY MODE | SINGLE, LOOP | Playback mode |

## Track Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| TYPE | TONE, DRUM, LOOPER | Track type (KICK/SNARE/HIHAT/KIT default DRUM; BASS/INST1/INST2 default TONE) |
| VOLUME | 0–127 | Track volume |
| PAN | L64–63R | Track pan |
| MUTE | OFF, ON | Track mute |
| OCTAVE | -3–+3 | Octave shift |
| COARSE | -48–+48 | Pitch coarse tuning (semitones) |
| FINE | -50–+50 | Pitch fine tuning (cents) |
| MONO/POLY | MONO, POLY | Monophonic/polyphonic |
| LEGATO | OFF, ON | Legato mode |
| PORTA SW | OFF, ON | Portamento on/off |
| PORTA TIME | 0–127 | Portamento time |
| PORTA MODE | NORM, LEGATO | Portamento mode |
| CUTOFF | -64–+63 | Filter cutoff offset |
| RESONANCE | -64–+63 | Filter resonance offset |
| ATTACK | -64–+63 | Amp envelope attack offset |
| DECAY | -64–+63 | Amp envelope decay offset |
| RELEASE | -64–+63 | Amp envelope release offset |
| VIB RATE | -64–+63 | Vibrato rate offset |
| VIB DEPTH | -64–+63 | Vibrato depth offset |
| VIB DELAY | -64–+63 | Vibrato delay offset |
| MFX SW | OFF, ON | MFX on/off |
| DELAY SEND | 0–127 | Delay send level |
| REVERB SEND | 0–127 | Reverb send level |
| CHORUS SEND | 0–127 | Chorus send level |

### Clip Settings

| Parameter | Value | Description |
|-----------|-------|-------------|
| TRANS | ON, OFF | Key/scale auto-follow song settings |
| QUANT REC | OFF, 1/4, 1/8, 1/16, 1/32 | Real-time recording quantize |
| QUANT VAL | OFF, 1/4, 1/8, 1/16, 1/32 | Step recording quantize |

### Looper Settings

| Parameter | Value | Description |
|-----------|-------|-------------|
| LOOP MODE | LOOP, ONE SHOT | Looper playback mode |
| REC MODE | REPLACE, OVERDUB | Recording mode |
| PLAY LEVEL | 0–127 | Playback level |
| FADE TIME | 0–127 | Fade-out time |

## Tone Edit Parameters

Parameters marked with ASSIGN can be assigned to a knob.

### Common

| Parameter | Value | Description |
|-----------|-------|-------------|
| Tone Level | 0–127 | Overall tone volume |
| Portamento Switch | OFF, ON | Portamento on/off |
| Portamento Time | 0–127 | Portamento time |
| Mono/Poly | MONO, POLY | Voice mode |
| Legato Switch | OFF, ON | Legato on/off |
| Cutoff Offset | -64–+63 | Filter cutoff offset |
| Resonance Offset | -64–+63 | Resonance offset |
| Attack Offset | -64–+63 | Attack time offset |
| Release Offset | -64–+63 | Release time offset |
| Vibrato Rate | -64–+63 | Vibrato rate |
| Vibrato Depth | -64–+63 | Vibrato depth |
| Vibrato Delay | -64–+63 | Vibrato delay |

### MFX

| Parameter | Value | Description |
|-----------|-------|-------------|
| MFX Type | 00–90 | MFX algorithm (see MFX list below) |
| MFX Switch | OFF, ON | MFX on/off |

### MFX CTRL (Knob Assignments)

| Parameter | Value | Description |
|-----------|-------|-------------|
| CTRL1 Dest | (MFX parameter) | Destination of CTRL1 knob |
| CTRL1 Depth | -63–+63 | Amount of CTRL1 |
| CTRL2 Dest | (MFX parameter) | Destination of CTRL2 knob |
| CTRL2 Depth | -63–+63 | Amount of CTRL2 |
| CTRL3 Dest | (MFX parameter) | Destination of CTRL3 knob |
| CTRL3 Depth | -63–+63 | Amount of CTRL3 |
| CTRL4 Dest | (MFX parameter) | Destination of CTRL4 knob |
| CTRL4 Depth | -63–+63 | Amount of CTRL4 |

## Drum Kit Parameters

### Kit Common

| Parameter | Value | Description |
|-----------|-------|-------------|
| Kit Level | 0–127 | Overall kit volume |
| Kit MFX Type | 00–90 | MFX algorithm |
| Kit MFX Switch | OFF, ON | MFX on/off |

### Drum Instrument Edit (per pad)

| Parameter | Value | Description |
|-----------|-------|-------------|
| Inst Number | (list) | Selected drum instrument |
| Level | 0–127 | Instrument volume |
| Pan | L64–63R | Instrument pan |
| Coarse Tune | -48–+48 | Pitch (semitones) |
| Fine Tune | -50–+50 | Pitch (cents) |
| Cutoff | 0–127 | Filter cutoff |
| Resonance | 0–127 | Filter resonance |
| Attack | 0–127 | Envelope attack |
| Decay | 0–127 | Envelope decay |
| FX Send | OFF, ON | Send to MFX |
| Delay Send | 0–127 | Delay send level |
| Reverb Send | 0–127 | Reverb send level |
| Mute Group | OFF, 1–31 | Exclusive group (e.g., open/closed hi-hat) |

## Sample Edit Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| START | 0–sample length | Sample start point |
| END | 0–sample length | Sample end point |
| LOOP | OFF, ON | Loop playback |
| LOOP START | 0–sample length | Loop start point |
| GAIN | -INF, -42–+6 dB | Sample gain |

## System Parameters

### CTRL

| Parameter | Value | Description |
|-----------|-------|-------------|
| PAD VELO | FIX, 3 levels | Pad velocity curve |
| FIX VELO | 1–127 | Fixed velocity value |
| KNOB MODE | DIRECT, CATCH | Knob behavior |
| PEDAL FUNC | PLAY, TAP, ASSIGN | Pedal function |

### MIDI

| Parameter | Value | Description |
|-----------|-------|-------------|
| SYNC MODE | AUTO, INTERNAL, REMOTE | Clock sync mode |
| REMOTE CH | 1–16 | Remote MIDI channel |
| AUTO CH | OFF, ON | Auto channel routing (OFF = per-track channel routing) |
| Tx MIDI | OFF, ON | Transmit MIDI via USB |
| Rx MIDI | OFF, ON | Receive MIDI via USB |
| Tx CC | OFF, ON | Transmit control changes |
| Rx CC | OFF, ON | Receive control changes |
| Tx PC | OFF, ON | Transmit program changes |
| Rx PC | OFF, ON | Receive program changes |
| LOCAL | OFF, ON | Local control |

### DISPLAY

| Parameter | Value | Description |
|-----------|-------|-------------|
| CONTRAST | 1–10 | Display contrast |
| BRIGHTNESS | 1–10 | Display brightness |
| PAD BRIGHT | 1–10 | Pad LED brightness |
| AUTO OFF | OFF, 30min, 4H, 8H | Auto power-off timer |

### USB

| Parameter | Value | Description |
|-----------|-------|-------------|
| USB DRV | GENERIC, VENDOR | USB audio driver type |
| ROUTING | MIX, TRACK | USB audio routing mode |

## Arpeggio Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| ARP SW | OFF, ON | Arpeggio on/off |
| ARP STYLE | UP, DOWN, UP&DOWN, RANDOM, NOTE ORDER, CHORD | Arpeggio style |
| ARP OCTAVE | 1–4 | Octave range |
| ARP HOLD | OFF, ON | Hold mode |
| ARP RATE | 1/4, 1/8, 1/12, 1/16, 1/24, 1/32 | Note rate |

## Vocal Compressor

| Parameter | Value | Description |
|-----------|-------|-------------|
| COMP SW | OFF, ON | Compressor on/off |
| ATTACK | 0–127 | Attack time |
| RELEASE | 0–127 | Release time |
| THRESHOLD | 0–127 | Threshold level |
| RATIO | 1:1, 2:1, 4:1, 8:1, 16:1, INF:1 | Compression ratio |
| LEVEL | 0–127 | Output level |

---

## Effect Parameters

### Signal Chain

```
Track → [MFX] → [COMP] → [EQ] → [PAN] → Mixer
                                              ↓
                              [DELAY] → [REVERB] → Output
                                              ↓
                              [TOTAL EFFECT: Multi Comp → 5-Band EQ → Limiter]
```

### Total Effect: Multi Compressor

3-band compressor applied to the mix output.

| Parameter | Value | Description |
|-----------|-------|-------------|
| Comp Switch | OFF, ON | On/off |
| Low Gain | -15–+15 dB | Low band gain |
| Mid Gain | -15–+15 dB | Mid band gain |
| High Gain | -15–+15 dB | High band gain |
| Low Freq | 100–800 Hz | Low/Mid crossover |
| High Freq | 1000–8000 Hz | Mid/High crossover |

### Total Effect: 5-Band Equalizer

| Parameter | Value | Description |
|-----------|-------|-------------|
| EQ Switch | OFF, ON | On/off |
| Low Freq | 20–1000 Hz | Low band frequency |
| Low Gain | -15–+15 dB | Low band gain |
| LowMid Freq | 100–4000 Hz | Low-mid frequency |
| LowMid Gain | -15–+15 dB | Low-mid gain |
| LowMid Q | 0.5–16 | Low-mid bandwidth |
| Mid Freq | 200–8000 Hz | Mid frequency |
| Mid Gain | -15–+15 dB | Mid gain |
| Mid Q | 0.5–16 | Mid bandwidth |
| HighMid Freq | 400–16000 Hz | High-mid frequency |
| HighMid Gain | -15–+15 dB | High-mid gain |
| HighMid Q | 0.5–16 | High-mid bandwidth |
| High Freq | 1000–16000 Hz | High band frequency |
| High Gain | -15–+15 dB | High band gain |

### EQ (per Part 1–4)

| Parameter | Value | Description |
|-----------|-------|-------------|
| EQ Switch | OFF, ON | On/off |
| Low Freq | 20, 25, 31, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400 Hz | Low shelf frequency |
| Low Gain | -12–+12 dB | Low gain |
| Mid Freq | 200–8000 Hz | Mid frequency |
| Mid Gain | -12–+12 dB | Mid gain |
| Mid Q | 0.5–16 | Mid bandwidth |
| High Freq | 1000–16000 Hz | High shelf frequency |
| High Gain | -12–+12 dB | High gain |

### Delay

| Parameter | Value | Description |
|-----------|-------|-------------|
| Delay Type | SINGLE, PAN | Delay type |
| Delay Switch | OFF, ON | On/off |
| Delay Time (sync) | OFF, ON | Tempo sync |
| Delay Time | 1–1300 msec | Delay time |
| Delay Feedback | -98–+98 % | Feedback amount (negative inverts phase) |
| Delay HF Damp | 200–BYPASS Hz | High-frequency damping |
| Delay Level | 0–127 | Delay output level |

### Reverb

| Parameter | Value | Description |
|-----------|-------|-------------|
| Reverb Type | ROOM1, ROOM2, HALL1, HALL2, PLATE | Reverb algorithm |
| Reverb Switch | OFF, ON | On/off |
| Reverb Time | 0–127 | Decay time |
| Reverb Pre Delay | 0–127 | Pre-delay |
| Reverb HF Damp | 200–BYPASS Hz | High-frequency damping |
| Reverb Level | 0–127 | Reverb output level |

### Vocal Processor

| Block | Parameter | Value | Description |
|-------|-----------|-------|-------------|
| Noise Sup | Switch | OFF, ON | Noise suppressor on/off |
| Noise Sup | Threshold | 0–127 | Gate threshold |
| Enhance | Switch | OFF, ON | Enhancer on/off |
| Enhance | Sens | 0–127 | Sensitivity |
| Enhance | Mix | 0–127 | Wet/dry mix |
| Comp | Switch | OFF, ON | Compressor on/off |
| Comp | Attack | 0–127 | Attack time |
| Comp | Release | 0–127 | Release time |
| Comp | Threshold | 0–127 | Threshold |
| Comp | Ratio | 1:1–INF:1 | Compression ratio |
| Comp | Level | 0–127 | Output level |
| De-esser | Switch | OFF, ON | De-esser on/off |
| De-esser | Sens | 0–127 | Sensitivity |
| EQ | Switch | OFF, ON | Equalizer on/off |
| EQ | Low Gain | -12–+12 dB | Low band gain |
| EQ | Mid Gain | -12–+12 dB | Mid band gain |
| EQ | Mid Freq | 200–8000 Hz | Mid frequency |
| EQ | Mid Q | 0.5–16 | Mid bandwidth |
| EQ | High Gain | -12–+12 dB | High band gain |
| Pitch | Switch | OFF, ON | Pitch corrector on/off |
| Pitch | Type | SOFT, HARD | Correction type |
| Pitch | Key | C–B | Reference key |
| Pitch | Scale | MAJ, min, Chrm | Reference scale |
| Harmony | Switch | OFF, ON | Harmonizer on/off |
| Harmony | Voice1 | -24–+24 | Harmony 1 interval (semitones) |
| Harmony | Voice2 | -24–+24 | Harmony 2 interval |
| Harmony | Level1 | 0–127 | Harmony 1 level |
| Harmony | Level2 | 0–127 | Harmony 2 level |

---

## MFX Types (00–90)

### Filters & EQ

| # | Name | Description |
|---|------|-------------|
| 00 | Thru | No effect (bypass) |
| 01 | Equalizer | 4-band parametric EQ (Low, Mid1, Mid2, High) |
| 02 | Spectrum | 8-band graphic equalizer |
| 03 | Isolator | DJ-style frequency isolator (Low/Mid/High with boost/cut) |
| 04 | Low Boost | Low-frequency shelf boost |
| 88 | Multi Mode Filter | DJ performance filter (LPF/HPF, LPF, HPF, BPF) |

### Phasers

| # | Name | Description |
|---|------|-------------|
| 05 | Super Filter | Resonant filter with LFO modulation |
| 06 | Step Filter | Filter with step-sequenced cutoff |
| 07 | Auto Wah | Envelope-controlled wah |
| 08 | Humanizer | Vowel-formant filter (a/e/i/o/u morphing) |
| 09 | Phaser | 8-stage phaser |
| 10 | Step Phaser | Phaser with step modulation |
| 90 | Phaser 100 | Analog phaser simulation |

### Modulators

| # | Name | Description |
|---|------|-------------|
| 11 | Ring Modulator | Ring modulation |
| 12 | Slicer | Rhythmic amplitude gate |
| 13 | Rotary | Rotary speaker (slow/fast toggle) |
| 14 | VK Rotary | Organ-style rotary speaker |

### Tremolo & Pan

| # | Name | Description |
|---|------|-------------|
| 15 | Tremolo | Amplitude tremolo |
| 16 | Auto Pan | Automatic stereo panning |
| 17 | Step Pan | Step-sequenced panning |

### Chorus & Flanger

| # | Name | Description |
|---|------|-------------|
| 18 | Chorus | Standard chorus |
| 19 | Flanger | Standard flanger |
| 20 | Step Flanger | Step-modulated flanger |
| 72 | CE-1 | BOSS CE-1 chorus emulation |
| 74 | SDD-320 | Roland Dimension D (SDD-320) chorus |
| 87 | JUNO-106 Chorus | Roland JUNO-106 chorus emulation |
| 73 | SBF-325 | Roland SBF-325 analog flanger (modes: FL1/FL2/FL3/CHO) |

### Overdrive & Distortion

| # | Name | Description |
|---|------|-------------|
| 21 | Overdrive | Tube-style overdrive |
| 22 | Distortion | Hard distortion |
| 86 | Fuzz | Fuzz distortion with pre/post filter and tone control |
| 89 | HMS Distortion | Vacuum tube amp + rotary speaker distortion |

### Dynamics

| # | Name | Description |
|---|------|-------------|
| 23 | Compressor | Standard compressor |
| 24 | Limiter | Brick-wall limiter |
| 25 | Gate | Noise gate |

### Delays

| # | Name | Description |
|---|------|-------------|
| 26 | Delay | Mono delay with HF damp |
| 27 | Long Delay | Long mono delay |
| 28 | Serial Delay | Two delays in series |
| 29 | Modulation Delay | Delay with chorus modulation |
| 30 | 3Tap Pan Delay | 3-tap stereo delay with individual pan |
| 31 | 4Tap Pan Delay | 4-tap stereo delay with individual pan |
| 32 | Multi Tap Delay | Complex multi-tap delay |
| 33 | Reverse Delay | Reverse-playback delay |
| 34 | Time Ctrl Delay | Delay with smooth time change (pitch effect) |
| 35 | Long Reverse Delay | Long reverse delay |
| 75 | 2Tap Pan Delay | Double tap stereo delay with HF damp and 2-band EQ |

### Lo-Fi

| # | Name | Description |
|---|------|-------------|
| 36 | LOFI Compress | Bit-reduction + compression |
| 37 | Bit Crusher | Bit depth and sample rate reduction |

### Pitch

| # | Name | Description |
|---|------|-------------|
| 38 | Pitch Shifter | Pitch shift (1 or 2 voices) |
| 39 | 2Voice Pitch Shifter | Dual pitch shifter with independent intervals |

### Combo Effects

| # | Name | Description |
|---|------|-------------|
| 40 | OD → Chorus | Overdrive into chorus |
| 41 | OD → Flanger | Overdrive into flanger |
| 42 | OD → Delay | Overdrive into delay |
| 43 | Dist → Chorus | Distortion into chorus |
| 44 | Dist → Flanger | Distortion into flanger |
| 45 | Dist → Delay | Distortion into delay |
| 46 | Enhancer → Chorus | Enhancer into chorus |
| 47 | Enhancer → Flanger | Enhancer into flanger |
| 48 | Enhancer → Delay | Enhancer into delay |
| 49 | Chorus → Delay | Chorus into delay |
| 50 | Chorus → Flanger | Chorus into flanger |
| 51 | Chorus → Distortion | Chorus into distortion |
| 52 | Flanger → Delay | Flanger into delay |
| 53 | Flanger → Distortion | Flanger into distortion |
| 54 | Dist → OD | Distortion into overdrive |

### Guitar Amp Simulators

| # | Name | Description |
|---|------|-------------|
| 55 | Guitar Amp Sim | Guitar amp + cabinet simulation |
| 56 | Stereo Guitar Amp Sim | Stereo guitar amp + cabinet |
| 57 | Clean Guitar Amp Sim | Clean guitar amp |
| 58 | Guitar Amp → Chorus | Guitar amp into chorus |
| 59 | Guitar Amp → Flanger | Guitar amp into flanger |
| 60 | Guitar Amp → Delay | Guitar amp into delay |

### Electric Piano Simulators (EPAmpSim)

| # | Name | Description |
|---|------|-------------|
| 61 | EPAmpSim → Tremolo | EP amp sim + speaker + tremolo (OLDCASE/NEWCASE/WURLY types) |
| 62 | EPAmpSim → Chorus | EP amp sim + speaker + chorus |
| 63 | EPAmpSim → Flanger | EP amp sim + speaker + flanger |
| 64 | EPAmpSim → Phaser | EP amp sim + speaker + phaser with resonance |
| 65 | EPAmpSim → Delay | EP amp sim + speaker + time-controlled delay |
| 81 | RD EPAmpSim | RD SuperNatural E.Piano sim (bass/treble/tremolo/amp/speaker/OD) |

### Enhancer Combos

| # | Name | Description |
|---|------|-------------|
| 66 | Enhancer → Chorus | Enhancer into chorus |
| 67 | Enhancer → Flanger | Enhancer into flanger |
| 68 | Enhancer → Delay | Enhancer into delay |

### Chorus/Flanger Combos

| # | Name | Description |
|---|------|-------------|
| 69 | Chorus → Delay | Chorus into delay |
| 70 | Flanger → Delay | Flanger into delay |
| 71 | Chorus → Flanger | Chorus into flanger |

### Transient & Spatial

| # | Name | Description |
|---|------|-------------|
| 76 | Transient | Attack/release envelope shaper |
| 77 | Mid-Side EQ | M/S 5-band EQ for stereo width control |
| 78 | Mid-Side Compressor | M/S dual compressor for stereo dynamics |
| 79 | Tone Fattener | Odd/even overtone generator for harmonic distortion |
| 80 | Mid-Side Delay | M/S multi-tap delay for stereo depth |

### Loopers & DJ

| # | Name | Description |
|---|------|-------------|
| 82 | DJFX Looper | Turntable-style loop with speed/direction control |
| 83 | BPM Looper | Tempo-synced loop with auto on/off timing |

### Saturators

| # | Name | Description |
|---|------|-------------|
| 84 | Saturator | Overdrive + pre-filter + 3 post-filters |
| 85 | Warm Saturator | Warm saturation + low/high input filter + 3 post-filters |

---

## MFX Common Parameters

Most combo/EPAmpSim effects share these parameters for their respective sections:

### Overdrive/Distortion section
- Drive (0–127): Distortion amount
- Level (0–127): Output level
- Tone (varies): Tone color

### Chorus section
- Chorus Pre Delay (0.0–100 msec): Pre-delay
- Chorus Rate (sync/Hz/note): Modulation rate
- Chorus Depth (0–127): Modulation depth
- Chorus Balance (D100:0W–D0:100W): Dry/wet balance

### Flanger section
- Flanger Pre Delay (0.0–100 msec): Pre-delay
- Flanger Rate (sync/Hz/note): Modulation rate
- Flanger Depth (0–127): Modulation depth
- Flanger Feedback (-98–+98 %): Feedback (negative inverts phase)
- Flanger Balance (D100:0W–D0:100W): Dry/wet balance

### Delay section
- Delay Time (sync/msec/note): Delay time
- Delay Feedback (-98–+98 %): Feedback
- Delay HF Damp (200–BYPASS Hz): High-frequency damping
- Delay Balance (D100:0W–D0:100W): Dry/wet balance

### EPAmpSim section
- Type: OLDCASE (70s), NEWCASE (late 70s–80s), WURLY (60s), DYNO, others
- Bass (-50–+50): Low frequency boost/cut
- Treble (-50–+50): High frequency boost/cut
- Speaker Type: LINE, OLD, NEW, WURLY, TWIN
- OD Switch/Gain/Drive: Overdrive on/off, input level, distortion amount

### Enhancer section
- Enhancer Sens (0–127): Sensitivity
- Enhancer Mix (0–127): Overtone mix level

### Rate sync behavior
When Rate (sync sw) = ON, the rate synchronizes with the project tempo. Rate values use musical note divisions (see Note table).

---

## Note Value Reference

From fastest to slowest:

| Symbol | Note Value |
|--------|-----------|
| 64T | Sixty-fourth-note triplet |
| 64 | Sixty-fourth note |
| 32T | Thirty-second-note triplet |
| 32 | Thirty-second note |
| 16T | Dotted thirty-second / sixteenth triplet |
| 16 | Sixteenth note |
| 8T | Eighth-note triplet |
| d16 | Dotted sixteenth |
| 8 | Eighth note |
| 4T | Quarter-note triplet |
| d8 | Dotted eighth note |
| 4 | Quarter note |
| 2T | Half-note triplet |
| d4 | Dotted quarter note |
| 2 | Half note |
| 1T | Whole-note triplet |
| d2 | Dotted half note |
| 1 | Whole note |
| d1 | Dotted whole note |
| 2x | Double note |
| 2xT | Double-note triplet |

---

## Block Diagram

```
TRACK (KICK, SNARE, HI-HAT, KIT, BASS, INST1, INST2):
  [TONE/DRUM/LOOPER] → Position → [COMP] → [MFX] → [COMP] → [EQ] → [PAN] →─┐
                                                                               │
TRACK VOCAL:                                                                   │
  [TAKE 1–16] → Position → [VOCAL PROCESSOR] → [COMP] → [MFX] → [EQ] → [PAN]─┤
                                                                               │
EXT IN (Built-in MIC, MIC IN, LINE IN):                                        │
  → [VOCAL PROCESSOR] ─────────────────────────────────────────────────────────┤
                                                                               │
USB OUT PC (CH1-2):                                                            │
  → [VOCAL PROCESSOR] → [PAN] ────────────────────────────────────────────────┤
                                                                               │
                                                          ┌────────────────────┘
                                                          ↓
                                                    ┌─[DELAY]─┐
                                                    └─[REVERB]─┘
                                                          ↓
TOTAL EFFECT (mastering):                                 ↓
  [MFX] → [MULTI COMP] → [5 BAND EQ] → [LIMITER] → Output
                                                          ↓
                                              ┌───────────┴───────────┐
                                          PHONES/LINE OUT     USB OUT MIX
                                                           CH1-2(Generic)
                                                           CH3-4(Vendor)

USB IN: Track 1 = CH3-4(Vendor), Track 7 = CH15-16(Vendor),
        Track 8 = CH17-18(Vendor), EXT IN = CH19-20(Vendor)
```
