# verselab-player

Real-time MIDI sequencer for the **Roland Verselab MV-1**. Write patterns in YAML, play them live with hot-reload, control tracks interactively, and export to the MV-1's internal storage.

```
+--------------------------------------------------+------------------------+
|  > MV-1 -- Esc to stop                           |  # Holding On          |
+--------------------------------------------------+------------------------+
|  * ch1  drums    [&] #1  16st                    |  120 BPM *             |
|  |....|>...|....|....|                           |  bar 3:2 / 8           |
|  | =  |#   | +  |    |                           |  ========--------      |
|  ------------------------------------            |                        |
|  * ch2  bass     [e] #1  32st                    |  ######------ drums    |
|  |X...|....|X...|....|                           |  ###---------- bass    |
|  |=   |    |=   |    |                           |  ####--------- chords  |
+--------------------------------------------------+                        |
|  Mute: &e'"(-ea  Solo: 1234                      |                        |
+--------------------------------------------------+------------------------+
```

> `*` = active track, `>` = playhead, `X` = note hit, `=`/`+`/`#` = velocity levels

---

## Features

- **YAML patterns** — drum grids, note lists, multi-section arrangements, all in readable text files
- **Hot-reload** — edit any YAML file while playing; changes take effect on the next loop, no interruption
- **Precise timing** — playback runs in a dedicated worker thread with sub-millisecond scheduling
- **MIDI clock** — send Start/Clock to lock the MV-1's sequencer to your tempo, or wait for its START signal
- **Live controls** — mute and solo tracks on the fly, seek by bar or jump between sections with arrow keys
- **Terminal UI** — per-track step grid, velocity graph, VU meters, BPM pulse, adaptive layout
- **Song mode** — plays the full arrangement once (no loop); single sequences still loop
- **Capture** — record patterns directly from the MV-1 into YAML track files
- **SMF export** — export sequences as `.mid` files to the MV-1's USB storage for direct import

---

## Requirements

- Node.js 20+
- A [Roland Verselab MV-1](https://www.roland.com/global/products/mv-1/) (or any MIDI device)
- A MIDI interface recognised by your OS (USB class-compliant or via ALSA/CoreMIDI)

---

## Installation

```bash
git clone https://github.com/openhoat/verselab-player.git
cd verselab-player
npm install
npm run build
```

Link the CLI commands globally:

```bash
npm link
```

---

## Quick Start

```bash
# Play a song (plays arrangement once, no loop)
verselab-play my-song/

# Play a single sequence (loops automatically)
verselab-play my-song/ --seq 2

# Play and send MIDI clock to lock the MV-1's sequencer
verselab-play my-song/ --clock

# Wait for the MV-1's PLAY button before starting
verselab-play my-song/ --wait --clock

# Play a named section
verselab-play my-song/ --section verse
```

---

## Song Structure

A song is a directory containing a `song.yml` file, section definitions, and sequence files.

```
my-song/
├── song.yml                 # metadata and arrangement
├── sections/
│   ├── 1-intro.yml          # section: which sequences to play, how many repeats
│   ├── 2-verse.yml
│   └── 3-chorus.yml
└── sequences/
    ├── 1/                   # sequence 1 — one file per track
    │   ├── 1-drums.yml
    │   ├── 2-bass.yml
    │   └── 3-chords.yml
    └── 2/
        └── ...
```

### `song.yml`

```yaml
meta:
  title: Holding On
  bpm: 120

arrangement:
  - 1-intro
  - 2-verse
  - 2-verse
  - 3-chorus
```

### Section file

```yaml
# sections/2-verse.yml
repeat: 4
tracks:
  1: sequences/2
  2: sequences/2
  3: sequences/1   # reuse sequence 1 for track 3
```

### Drum track (pattern syntax)

```yaml
# sequences/1/1-drums.yml
channel: 10
clip: 1

kick:   x---x---x---x---
snare:  ----x-------x---
hihat:  x-x-x-x-x-x-x-x
```

Pattern characters:

| Char | Meaning              |
|------|----------------------|
| `x`  | Hit (velocity 100)   |
| `X`  | Accent (velocity 127)|
| `o`  | Ghost note (vel 40)  |
| `g`  | Ghost note (vel 40, alias) |
| `-`  | Rest                 |
| `\|` | Visual bar separator (ignored) |

### Melodic track (note list)

```yaml
# sequences/1/2-bass.yml
channel: 2
clip: 1
steps: 32

notes:
  - { step: 1,  note: C2,  vel: 100, dur: 4 }
  - { step: 5,  note: Eb2, vel: 90,  dur: 2 }
  - { step: 9,  note: G2,  vel: 95,  dur: 4, sta: 2 }
  - { step: 17, note: C2,  vel: 100, dur: 8 }
```

The `sta` field is a **Start Time Adjustment** (0–5 clocks within a step), which matches the MV-1's internal timing resolution at 24 PPQN.

---

## Commands

### `verselab-play` — Live playback

```
verselab-play <song-dir> [options]

Options:
  -s, --seq <n>          Play a single sequence
  -S, --section <spec>   Play a single section (by number or name)
  -t, --track <spec>     Only activate one track (channel, name, or prefix)
  -w, --wait             Wait for MV-1 START signal before playing
      --clock            Send MIDI Start + Clock (locks MV-1 sequencer to tempo)
      --no-watch         Disable hot-reload
  -h, --help             Show help
```

Press `Esc` or `Ctrl-C` to stop.

---

### `verselab-scan` — Capture from MV-1

Records a pattern played on the MV-1 into YAML track files. Listens for MIDI Start/Stop/Clock to sync timing, then writes one `.yml` file per MIDI channel detected.

```
verselab-scan <song-dir> <sequence> [options]

Options:
  --bars <n>     Number of bars to record (default: 2)
  --bpm <n>      Override BPM (auto-detected from MIDI Clock if omitted)
  --verbose      Log all incoming MIDI messages
```

Example:

```bash
verselab-scan my-song/ 1 --bars 4 --bpm 120
```

---

### `verselab-record` — Play a track for MV-1 recording

Plays a single track once in non-looping mode. Waits for you to press Enter after you've set the MV-1 to record.

```
verselab-record <song-dir> <sequence> <track>

# track: channel number, name, or name prefix
verselab-record my-song/ 1 2        # channel 2
verselab-record my-song/ 1 bass     # track named "bass"
verselab-record my-song/ 1 2-bass   # channel 2 named "bass"
```

---

### `verselab-export` — Export to SMF

Exports each track of a sequence as a `.mid` file (SMF Type 0, 24 PPQN). If the MV-1 is connected in Storage mode, files are written directly to its `ROLAND/MV/MIDI/` folder. Requires firmware v1.80+.

```
verselab-export <song-dir> <sequence> [--output <dir>]
```

Output file naming: `{song}_{seq}_ch{channel}_{trackname}.mid`

```bash
verselab-export my-song/ 1                       # auto-detect MV-1 mount
verselab-export my-song/ 1 --output ~/Desktop/   # custom directory
```

---

### `verselab-init` — Initialise schema validation

Sets up YAML Language Server schema files so your editor (VS Code, Neovim, etc.) provides autocompletion and validation for song files.

```bash
verselab-init
```

---

### Linter

Validates song structure, YAML syntax, pattern correctness, and note ranges.

```bash
npm run lint:verselab my-song/        # lint a single song
npm run lint:verselab songs/          # lint all songs
npm run lint:verselab my-song/ --style  # include style suggestions
```

---

### Sound catalog

Browse and validate MV-1 instrument sounds.

```bash
npm run sounds search piano
npm run sounds list --section Tone --category Piano
npm run sounds validate my-song/
npm run sounds fix my-song/ --write    # normalise sound field names
```

---

## Live Controls

During playback, use single keystrokes for muting/soloing and arrow keys for navigation.

### Seek and navigation

| Key       | Action                         |
|-----------|--------------------------------|
| `Left`    | Seek backward by one bar       |
| `Right`   | Seek forward by one bar        |
| `Up`      | Jump to previous section       |
| `Down`    | Jump to next section           |
| `Esc`     | Stop playback                  |

### Mute and solo (AZERTY, default)

| Action                 | Keys                          |
|------------------------|-------------------------------|
| Mute track 1–7         | `&` `é` `"` `'` `(` `-` `è` |
| Mute all / unmute all  | `à`                          |
| Solo track 1–7         | `1` `2` `3` `4` `5` `6` `7` |

> Solo: press once to isolate a track, press again on the same key to restore.

### Mute and solo (QWERTY)

| Action                 | Keys                          |
|------------------------|-------------------------------|
| Mute track 1–7         | `1` `2` `3` `4` `5` `6` `7` |
| Mute all / unmute all  | `0`                          |
| Solo track 1–7         | `!` `@` `#` `$` `%` `^` `&` |

---

## Environment Variables

| Variable               | Description                                    | Default              |
|------------------------|------------------------------------------------|----------------------|
| `VERSELAB_SONGS_HOME`  | Base directory for song path resolution        | Current directory    |
| `VERSELAB_MOUNT`       | MV-1 USB storage mount point                   | Auto-detect          |
| `VERSELAB_KEYBOARD`    | Keyboard layout: `azerty` or `qwerty`          | `azerty`             |
| `VERSELAB_KEYBINDINGS` | Path to a custom keybindings JSON file         | —                    |
| `VERSELAB_DIAG`        | Set to `1` to print timing diagnostics         | —                    |

The MV-1 mount is auto-detected by scanning `/run/media/<user>`, `/media/<user>` (Linux) and `/Volumes` (macOS) for a `ROLAND/MV/MIDI/` sub-directory.

---

## Development

```bash
npm run dev            # run directly with tsx (no build step)
npm test               # unit + e2e tests
npm run build          # compile to dist/
npm run validate       # build + test + lint all songs
```

---

## License

MIT © [Olivier Penhoat](http://headwood.net/)
