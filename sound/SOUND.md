# Sound: the score

`art/STYLE.md` governs the paintings; this file governs the music. Read it
before scoring a section.

## The idea

The music is a **Persian ensemble playing in the dark beside the reader**:
santur, ney, frame drum, karnay, a drone and the air around them. It follows
the journey the way the camera does. Each painting has its own atmosphere, and
each couplet's appearance is answered. Portals ring, and the ending opens into
light.

It is **generated live in the browser** with Web Audio. There are no audio
files, so there is nothing to license or download, and the music is locked
to the scroll. A score is **data**: each scene names an atmosphere. So any
agent can score a new section, or design a new atmosphere, without touching
the engine.

The rules that matter most:

1. **The verse comes first.** Music sits under the reading, never on top of
   it. It is quiet (about −23 LUFS), and it leaves room while a couplet is read.
2. **Persian, not generic "epic".** The melodic voices play in real Persian
   modes with their neutral (koron) intervals. There are no orchestral hits
   and no Western chord progressions.
3. **One tonic (D) for the whole book**, so moving to the next section never
   changes key. Atmospheres change the mode, not the tonic.
4. **Reproducible.** Randomness is seeded by the section id. The same section,
   read the same way, plays the same music, and `scripts/listen.mjs` renders it
   identically every time. A section whose id was aligned to its chapter keeps
   the seed it was reviewed with.

## How it follows the reader

| Moment | What plays | Where |
| --- | --- | --- |
| Threshold | The `threshold` atmosphere (a homayun drone, a sparse santur) | `scenes[0]` |
| Dive | Wind rushes, and the next scene's atmosphere glides in over about 1.6s. A bell on the mode's focal note sounds over a falling low swell as the portal opens. | automatic |
| Scene | The drone, beds and drums of the scene's atmosphere. The santur wanders around the mode's focal note between couplets. | `scene.sound` |
| Couplet appears | The voices in `answer` respond (santur run and tremolo, ney phrase, karnay call, bell, dohol roll), then leave a few seconds of space for reading. Plus any `cue` for that couplet. | `answer`, `cues` |
| Scrolling | Wind rises with scroll speed | automatic |
| Ending | The `radiance` atmosphere: bells climb a bright Mahur chord, the ney sings the tonic, then it settles to a quiet drone under the closing page | automatic |

The home page and the contents page play the `threshold` atmosphere, and it crossfades into the section's score (one shared audio context). Sound is **on by default**. Browsers block audio until the reader first
clicks, taps or presses a key, so the music starts at that moment. Coming from
the home page, clicking «آغاز سفر» counts, so the music begins with the
section. Until then, the toggle (bottom left) pulses gently. A reader who
turns sound off stays off on later visits.

## The vocabulary

Everything lives in `src/content/sound.ts`.

### Modes

| Mode | Character | Use for |
| --- | --- | --- |
| `shur` | grave, inward, narrative | the default voice of the epic: counsel, story, thought |
| `dashti` | folk, yearning | laments, exile, wilderness, longing for home |
| `homayun` | solemn grandeur | invocation, fate, thresholds, the sacred |
| `segah` | tender and uncanny | love, dreams, demons, the otherworldly |
| `chahargah` | heroic, tense | battle, challenge, the champion's entrance |
| `mahur` | bright, regal | court, feasts, victory, the heavens, light |

### Atmosphere fields

| Field | Range | What it does |
| --- | --- | --- |
| `mode` | see above | scale for every melodic voice |
| `brightness` | 0–1 | opens or closes the filters across all voices (dark night → radiant) |
| `drone` | 0–1 | the breathing drone under everything |
| `santur` | notes/sec, 0–1.2 | the wandering santur line between couplets (0 = none) |
| `register` | 0 or 1 | santur around D4, or an octave higher (crystalline) |
| `ney` | 0–1 | strength of the ney's answer |
| `bells` | 0–1 | bells at portals and in answers |
| `drums` | `{ pattern, bpm, level }` | a 16-step loop: `D` dum, `t` tak, `k` soft ka, `j` daf jingle, `.` rest |
| `wind` | 0–1 | air moving: open land, height, travel |
| `rumble` | 0–1 | deep earth noise: armies, storms, demons, creation |
| `answer` | list of `santur` `ney` `horn` `bell` `drum` | what responds when each couplet appears |

### Cues

These are one-off sounds tied to a couplet the text names. Use them sparingly:
a few per section, at most.

| Cue | Use for |
| --- | --- |
| `strike` | a blow lands, swords clash, a mace falls |
| `horn` | war is declared, a king arrives, an army sets out |
| `gong` | a death, a doom, an irrevocable decree |
| `thunder` | a demon appears, a storm, divine anger |
| `hush` | everything drops away. Use it for the line that should be read in silence (Sohrab's recognition, Siyavash's oath). |

## The atmosphere library

| Atmosphere | Mode | For scenes of… | Shahnameh examples |
| --- | --- | --- | --- |
| `threshold` | homayun | gateways, titles (default for `scenes[0]`) | every section's opening page |
| `intimate` | shur | a lamp, one figure, a close room | 01.01 lamp; a king alone at night |
| `vast` | mahur | open sky, turning heavens, great landscapes | 01.01 heavens; the world described |
| `wonder` | mahur | revelation, radiance | 01.01 beyond name; Farr descending |
| `contemplative` | shur | thought, counsel, wisdom (default) | praise of wisdom, a vizier's advice |
| `journey` | shur | roads, quests, seeking | Rostam's seven trials (between labours) |
| `tender` | segah | age, affection, gentle longing | Zal returned to Sam |
| `mystery` | segah | veils, the unknowable, absence | 01.01 the veil |
| `radiance` | mahur | the ending (used automatically) | every section's last page |
| `genesis` | homayun | creation, the elements | creation of the world, sun, moon |
| `court` | mahur | thrones, audiences, decrees | Jamshid's court, Kay Kavus enthroned |
| `feast` | mahur | celebrations, weddings, Nowruz | Jamshid's Nowruz, royal weddings |
| `muster` | chahargah | armies gathering, challenges | Iran and Turan drawn up for war |
| `battle` | chahargah | combat itself | Rostam and Sohrab, Rostam and Esfandiyar |
| `lament` | dashti | death, mourning | Sohrab's death, Siyavash's death |
| `love` | segah | love and courtship | Zal and Rudabeh, Bizhan and Manizheh |
| `demonic` | segah | demons, sorcery, serpents | Zahhak's serpents, the White Div |
| `dream` | segah | dreams, omens, the Simorgh | Zahhak's dream, the Simorgh's nest |
| `wild` | dashti | wilderness, hunting, solitude | Zal abandoned on Alborz, a hunt |

## Scoring a section

1. **Read the section and mark its emotional turns.** Note them per scene,
   not per couplet: a scene holds one atmosphere.
2. **Give each scene a `sound`** in its content file. Prefer a library name:
   ```ts
   { image: art("03-razm"), couplets: [9, 10, 11], sound: "battle" }
   ```
   Adjust one with overrides and cues when the text asks for it:
   ```ts
   sound: { like: "battle", brightness: 0.35, cues: [{ couplet: 11, sound: "strike" }] }
   ```
3. **Shape the arc across scenes.** A dive is a modulation, so neighbours
   should be related. Avoid jumping between extremes every scene unless the
   story does (a feast broken by an alarm is a good reason). Let the
   brightness follow the light of the paintings.
4. **Render and check** (below).

## Designing a new atmosphere

Add one to `ATMOSPHERES` when no existing one fits a recurring type of scene
(a siege, a wedding procession, a sea crossing). Give it a plain name for the
scene type, a doc comment saying when to use it, and a row in the library
table above. Start from the closest existing atmosphere and change two or
three fields. Big changes to many fields usually mean you have two
atmospheres. If a scene needs a **new voice or cue** (water, fire, crowd), add
it to the vocabulary types and implement it in `src/engine/sound.ts`, then
document it here.

## Render and check

Agents can't listen, so check by rendering and measuring. Then give the files
to the owner to listen to.

```sh
pnpm dev --port 5199
node scripts/listen.mjs section 01.02 /tmp/01-02 --port 5199      # a whole section, read at a steady pace
node scripts/listen.mjs audition battle,lament /tmp/try --port 5199  # one scene per atmosphere ("all" for every one)
ffmpeg -v error -y -i /tmp/01-02.wav -lavfi "showspectrumpic=s=1600x500:legend=1:scale=log:fscale=log:start=40:stop=8000" /tmp/01-02-spec.png
```

`listen.mjs` writes WAV and M4A files and prints duration, peak and
integrated loudness. Check:

- **Peak** below −1 dBFS, and **loudness** around −26 to −20 LUFS. Background
  music, not foreground.
- **No silence** where a scene should play, and no section where one voice
  dominates. Look at the spectrogram: ney phrases show as blobs at about
  300–600 Hz, the santur as bright ticks, drums as vertical stripes and the
  rumble as a band under 100 Hz.
- **Contrast between scenes** shows on the spectrogram as a visible change in
  density or brightness at each dive.

## Known limits

- Synthesised instruments are evocative, not a recording of a real ensemble.
  The santur and ney are the most convincing and the karnay the least.
  Recorded stems (licensed or commissioned) could later replace individual
  voices behind the same atmosphere data.
- Drums keep their own tempo. They are not synced to scroll speed, because
  reading pace isn't a rhythm.
