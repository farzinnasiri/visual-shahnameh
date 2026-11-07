# Art style: نگارگری شب‌لاجوردی (lapis-night miniature)

Every illustration in the visual Shahnameh follows this file. Keep it short
enough to paste into an image prompt, and change it only on purpose: a style
change here changes the whole book.

## The look in one paragraph

Persian manuscript painting from the Timurid and Safavid workshops (Herat and
Tabriz, 15th–16th century): opaque mineral pigment and gold leaf on burnished
paper, fine single-hair brushwork, flat stacked space with a high horizon, and
no Western shading or perspective. Our variation is the **night**: deep
lapis-lazuli skies, gold that glows as if lit from inside, and a single
luminous focal point at the centre of each painting. It should read as an
illuminated page seen by lamplight. It should not look like a fantasy poster,
a 3D render or a photograph.

## Rules for every painting

1. **Centre focus.** Aim the most luminous element at the centre of the
   frame. The reader's camera dives into that painted light to reach the next
   scene. Record its actual location in `Scene.focus` if it is off-centre;
   never substitute a face or an empty point to compensate for a crop.
2. **Composition area.** Keep important action inside the central ~45% width;
   the sides must still be beautiful. This is composition guidance, not a
   visibility guarantee for an immersive cover camera or a transition dive.
   The default portrait reader fits the whole painting above a separate verse
   region, over a soft full-bleed backdrop. An explicit immersive section and
   the light-centred dives can crop differently with viewport shape and zoom;
   inspect the actual reader rather than relying on prompt coordinates alone.
3. **No text, no frames, no borders, no margins, no signatures.** Calligraphy,
   rulings and illumination are drawn in code. The painting runs full-bleed.
4. **Format.** Landscape 3:2 (1536×1024) unless the prompt says otherwise.
5. **The divine is never depicted.** No face or figure for God, and no
   religious figures. Show the divine as light, veils, order and absence.
6. **People are small.** Figures, when present, are small in the composition:
   miniature-style faces and costume, never photoreal.
7. **Palette** (see `DESIGN.md` for hex values): lapis lazuli, ultramarine
   night, shell gold, vermilion, malachite, turquoise, saffron, ivory and
   lamp-black. Limit the vermilion to small accents.
8. **Texture.** Visible paper grain, gold leaf with slight craquelure, and
   pigment that pools a little at its edges. Nothing glossy, airbrushed or
   neon.
9. **Recurring motifs.** Chinese-style cloud bands (*chi*) in gold, spongy
   coloured rocks, plane and cypress trees, star fields drawn as small gold
   rosettes, and arabesque (*eslimi*) scrolls.
10. **Same person, same look.** Anyone who appears in more than one
    painting (a king, a hero, a div, a horse such as Rakhsh) has a character
    sheet in `art/characters/<name>.md`: age, build, face, beard, crown or
    helmet, colours of robe and armour, emblem, weapon. Paste the sheet's
    "prompt line" into every prompt where they appear. Before writing a
    sheet, check whether one exists (Rostam appears in a dozen chapters);
    reuse it and never rewrite someone else's. If you must add a detail, append
    it under a dated note.
11. **No anachronisms.** The heavens are drawn as the 15th century drew them:
    planets as gold roundels, rosettes or personified figures, never as
    modern astronomy (no ringed Saturn, no spiral galaxies, no photographic
    moon). No modern objects, no gunpowder weapons, no Western architecture.
12. **Darkness and violence** stay within the manuscript tradition: battles
    are dense and stylised; wounds and death are shown with restraint (a fallen
    figure, a riderless horse). No gore.

## Prompt template

```
Persian miniature painting, Timurid–Safavid manuscript style (Herat/Tabriz
school, 15th–16th century), opaque mineral pigments and shell gold on
burnished paper, fine brushwork, flat stacked perspective, no Western
shading. Night palette: deep lapis-lazuli and ultramarine, glowing gold leaf,
small vermilion accents, malachite and turquoise, ivory. Visible paper grain
and slight gold craquelure.
SUBJECT: <scene>.
COMPOSITION: <what sits where>; the brightest element is at the exact centre
of the frame; key content inside the central 45% width; full-bleed, landscape
3:2.
Strictly no text, letters, calligraphy, border, frame, margin or signature.
Not a 3D render, not photographic, not fantasy concept art.
```

**Light-layer elements** (cloud bands, sparks): paint them in luminous gold on a
**pure black (#000000) background** with nothing else in the frame. The
engine composites them with `mix-blend-mode: screen`, so the black disappears.
That way they don't need transparency.
