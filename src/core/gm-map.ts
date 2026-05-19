export const DRUM_CATEGORIES = new Set([
  'Drum Kit', 'Drums', 'Beat&Groove',
  'Kick', 'Elec Kick', 'Snare', 'Elec Snare', 'Clap',
  'Hi-Hat', 'Elec Hi-Hat', 'Cymbal', 'Ride', 'Tom', 'Elec Tom',
  'Stick&Click', 'Percussion', 'Perc 1', 'Perc 2', 'Perc 3', 'Perc 4',
])

const CATEGORY_DEFAULTS: Record<string, number> = {
  'Ac.Piano': 0, 'Pop Piano': 3,
  'E.Grand Piano': 2, 'E.Piano1': 4, 'E.Piano2': 5,
  'Clav': 7, 'Celesta': 8, 'Harpsichord': 6,
  'Mallet': 12, 'Bell': 14,
  'E.Organ': 16, 'Pipe Organ': 19, 'Reed Organ': 20,
  'Accordion': 21, 'Harmonica': 22,
  'Ac.Guitar': 24, 'E.Guitar': 27, 'Dist.Guitar': 30, 'Plucked/Stroke': 46,
  'Ac.Bass': 32, 'E.Bass': 33, 'Synth Bass': 38,
  'Ensemble Strings': 48, 'Solo Strings': 40, 'Orchestral': 48,
  'Ensemble Brass': 61, 'Solo Brass': 56, 'Synth Brass': 62,
  'Flute': 73, 'Recorder': 74, 'Wind': 71, 'Sax': 66,
  'Vox/Choir': 52, 'Scat': 54, 'Voice': 54,
  'Synth Lead': 80, 'Synth Seq/Pop': 81,
  'Synth Pad/Str': 89, 'Synth Bellpad': 88, 'Synth PolyKey': 90,
  'Synth FX': 99, 'Pulsating': 95, 'Stack': 38,
  'Phrase': 88, 'Hit': 55, 'FX': 96, 'Sound FX': 98, 'SFX': 98,
  'Play Noise': 121, 'Zone': 0, 'No Assign': 0,
  'Beat&Groove': 0, 'Percussion': 47,
}

interface NameRule {
  pattern: RegExp
  program: number
}

const NAME_RULES: NameRule[] = [
  // ── Piano ──
  { pattern: /bright/i, program: 1 },
  { pattern: /honky/i, program: 3 },
  { pattern: /e[\.\-]?grand/i, program: 2 },

  // ── Chromatic percussion ──
  { pattern: /vibraphone|vibe/i, program: 11 },
  { pattern: /marimba/i, program: 12 },
  { pattern: /xylophone/i, program: 13 },
  { pattern: /tubular|chime/i, program: 14 },
  { pattern: /steel\s*drum/i, program: 114 },
  { pattern: /kalimba/i, program: 108 },
  { pattern: /agogo/i, program: 113 },
  { pattern: /timpan/i, program: 47 },
  { pattern: /castanet/i, program: 115 },

  // ── Organ ──
  { pattern: /church|cathedral|pipe/i, program: 19 },
  { pattern: /reed\s*organ|harmonium/i, program: 20 },
  { pattern: /accordion/i, program: 21 },
  { pattern: /bandoneon/i, program: 23 },
  { pattern: /harmonica|harp\s*blues/i, program: 22 },

  // ── Guitar ──
  { pattern: /nylon/i, program: 24 },
  { pattern: /12[\-\s]*str/i, program: 25 },
  { pattern: /folk|steel.*gtr|comp.*steel/i, program: 25 },
  { pattern: /clean/i, program: 27 },
  { pattern: /jazz.*gtr/i, program: 26 },
  { pattern: /mute.*gtr|gtr.*mute/i, program: 28 },
  { pattern: /over\s*dr|crunch|od\s/i, program: 29 },
  { pattern: /dist/i, program: 30 },
  { pattern: /banjo/i, program: 105 },

  // ── Bass ──
  { pattern: /fretless|f'less/i, program: 35 },
  { pattern: /slap/i, program: 36 },
  { pattern: /finger.*b(ass|s)/i, program: 33 },
  { pattern: /pick.*b(ass|s)/i, program: 34 },
  { pattern: /upright/i, program: 32 },
  { pattern: /808/i, program: 38 },
  { pattern: /acid/i, program: 39 },
  { pattern: /sub\s*b/i, program: 38 },

  // ── Strings ──
  { pattern: /violin/i, program: 40 },
  { pattern: /viola\b/i, program: 41 },
  { pattern: /cello/i, program: 42 },
  { pattern: /contrabass/i, program: 43 },
  { pattern: /pizz/i, program: 45 },
  { pattern: /harp\b/i, program: 46 },

  // ── Brass ──
  { pattern: /trumpet|tpt\b|tp\b/i, program: 56 },
  { pattern: /trombone|tb\b/i, program: 57 },
  { pattern: /tuba/i, program: 58 },
  { pattern: /mute.*tr|harmon/i, program: 59 },
  { pattern: /french\s*horn/i, program: 60 },

  // ── Woodwind ──
  { pattern: /soprano.*sax/i, program: 64 },
  { pattern: /alto.*sax/i, program: 65 },
  { pattern: /tenor.*sax/i, program: 66 },
  { pattern: /bari.*sax/i, program: 67 },
  { pattern: /oboe/i, program: 68 },
  { pattern: /english\s*horn/i, program: 69 },
  { pattern: /bassoon/i, program: 70 },
  { pattern: /clarinet/i, program: 71 },
  { pattern: /piccolo/i, program: 72 },
  { pattern: /flute/i, program: 73 },
  { pattern: /recorder/i, program: 74 },
  { pattern: /ocarina/i, program: 79 },
  { pattern: /whistle/i, program: 78 },
  { pattern: /shakuhachi/i, program: 77 },
  { pattern: /bagpipe/i, program: 109 },
  { pattern: /shanai/i, program: 111 },

  // ── Plucked ──
  { pattern: /sitar/i, program: 104 },
  { pattern: /shamisen/i, program: 106 },
  { pattern: /koto/i, program: 107 },
  { pattern: /dulcimer/i, program: 15 },

  // ── Synth lead ──
  { pattern: /saw\s*lead|lead.*saw/i, program: 81 },
  { pattern: /square.*lead|lead.*square/i, program: 80 },
  { pattern: /calliope/i, program: 82 },
  { pattern: /chiff/i, program: 83 },
  { pattern: /charang/i, program: 84 },
  { pattern: /voice.*lead/i, program: 85 },
  { pattern: /5th/i, program: 86 },

  // ── Synth pad ──
  { pattern: /warm.*pad|pad.*warm/i, program: 89 },
  { pattern: /sweep/i, program: 95 },
  { pattern: /choir.*pad|pad.*choir|angel/i, program: 91 },
  { pattern: /bowed|metal.*pad/i, program: 92 },
  { pattern: /halo/i, program: 94 },

  // ── Choir / Voice ──
  { pattern: /choir/i, program: 52 },
  { pattern: /voice|vox|vocal/i, program: 54 },
  { pattern: /scat/i, program: 54 },

  // ── SFX ──
  { pattern: /applause/i, program: 126 },
  { pattern: /helicopter/i, program: 125 },
  { pattern: /gunshot/i, program: 127 },
  { pattern: /telephone|phone/i, program: 124 },
  { pattern: /bird/i, program: 123 },
  { pattern: /sea\s*shore|ocean|wave/i, program: 122 },
  { pattern: /rain/i, program: 121 },
  { pattern: /breath/i, program: 121 },
  { pattern: /reverse/i, program: 119 },
]

export function resolveGmProgram(soundName: string | undefined, category: string | undefined): number {
  if (soundName) {
    for (const rule of NAME_RULES) {
      if (rule.pattern.test(soundName)) return rule.program
    }
  }
  if (category) return CATEGORY_DEFAULTS[category] ?? 0
  return 0
}
