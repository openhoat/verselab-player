# Track Assignments - Roland Verselab MV-1

## Conventions par défaut

Les numéros de track correspondent aux canaux MIDI (1-16) sur le MV-1.

### Tracks standards

| Track | Canal | Instrument | Category |
|-------|-------|------------|----------|
| **4** | 4 | Drums | Drum Kit |
| **5** | 5 | Bass | Synth Bass / E.Bass |
| **6** | 6 | Keys | E.Piano1 / E.Piano2 |
| **7** | 7 | Pad | Synth Pad/Str |

### Tracks additionnelles (optionnelles)

| Track | Canal | Instrument | Usage typique |
|-------|-------|------------|---------------|
| 1 | 1 | Lead | Mélodie principale |
| 2 | 2 | Synth | Accords / layer |
| 3 | 3 | Strings | Nappes |
| 8-16 | 8-16 | Libre | Percussions, FX, etc. |

## Format des fichiers track

```yaml
track: 4                    # Canal MIDI (obligatoire)
sound: Trap Kit 2 (A,1)     # Nom du son + code Verselab
category: Drum Kit          # Catégorie (informationnelle)
steps: 16                   # Longueur de la boucle (optionnel)
```

## Codes Verselab

Le format `(Bank,Number)` indique la position du son dans le MV-1 :
- **DrumKit** : `A,1` = Bank A, position 1
- **Tone** : `D,22` = Bank D, position 22

Les codes sont extraits de `docs/mv1-sounds.csv`.