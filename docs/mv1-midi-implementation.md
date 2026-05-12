# Roland Verselab MV-1 — MIDI Implementation Chart

Model: MV-1 | Version: 1.02 | Date: 2020-12-10

## Basic Channel

| Function        | Transmitted | Recognized |
|-----------------|-------------|------------|
| Default         | 1–16        | 1–16       |
| Changed         | 1–16        | 1–16       |

## Mode

| Function        | Transmitted | Recognized |
|-----------------|-------------|------------|
| Default         | Mode 3      | Mode 3     |
| Messages        | x           | x          |
| Altered         | ********** | ********** |

Modes: 1 = Omni On/Poly, 2 = Omni On/Mono, 3 = Omni Off/Poly, 4 = Omni Off/Mono

## Note Number

| Function        | Transmitted | Recognized |
|-----------------|-------------|------------|
| True Voice      | 0–127       | 0–127      |

## Velocity

| Function        | Transmitted | Recognized |
|-----------------|-------------|------------|
| Note On         | o           | o          |
| Note Off        | x           | o          |

## After Touch

| Function        | Transmitted | Recognized |
|-----------------|-------------|------------|
| Key's           | x           | o          |
| Channel's       | x           | o          |

## Pitch Bend

| Transmitted | Recognized |
|-------------|------------|
| x           | o          |

## Control Change

| CC  | Name                | Transmitted | Recognized |
|-----|---------------------|-------------|------------|
| 1   | Modulation          | x           | o          |
| 5   | Portamento Time     | x           | o          |
| 7   | Volume              | x           | o          |
| 10  | Panpot              | x           | o          |
| 11  | Expression          | x           | o          |
| 64  | Hold 1              | x           | o          |
| 65  | Portamento          | x           | o          |
| 66  | Sostenuto           | x           | o          |
| 67  | Soft                | x           | o          |
| 68  | Legato Foot Switch  | x           | o          |
| 71  | Resonance           | x           | o          |
| 72  | Release Time        | x           | o          |
| 73  | Attack Time         | x           | o          |
| 74  | Cutoff              | x           | o          |
| 75  | Decay Time          | x           | o          |
| 76  | Vibrato Rate        | x           | o          |
| 77  | Vibrato Depth       | x           | o          |
| 78  | Vibrato Delay       | x           | o          |
| 80  | FILTER Knob         | o           | o          |
| 81  | MOD Knob            | o           | o          |
| 82  | FX Knob             | o           | o          |
| 83  | SOUND Knob          | o           | o          |
| 84  | Portamento Control  | x           | o          |
| 91  | Reverb Send Level   | x           | o          |
| 92  | —                   | x           | x          |
| 93  | Chorus Send Level   | x           | o          |

## Program Change

| Function        | Transmitted | Recognized |
|-----------------|-------------|------------|
| True Number     | x           | x          |

## System Exclusive

| Transmitted | Recognized |
|-------------|------------|
| x           | x          |

## System Common

| Function        | Transmitted | Recognized |
|-----------------|-------------|------------|
| Song Position   | x           | x          |
| Song Select     | x           | x          |
| Tune Request    | x           | x          |

## System Real Time

| Function        | Transmitted | Recognized |
|-----------------|-------------|------------|
| Clock           | o           | o          |
| Start           | o           | o          |
| Continue        | x           | o          |
| Stop            | o           | o          |

## Other Messages

| Function             | Transmitted | Recognized |
|----------------------|-------------|------------|
| All Sound Off        | x           | o          |
| Reset All Controllers| x           | o          |
| All Notes Off        | x           | o          |
| Omni Mode Off        | x           | o          |
| Omni Mode On         | x           | o          |
| Mono Mode On         | x           | x          |
| Poly Mode On         | x           | o          |

## Notes

- o = Yes, x = No
- Default channel is memorized
- CC80–83 correspond to the four physical knobs (FILTER, MOD, FX, SOUND)
