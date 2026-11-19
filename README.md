# Vice Ink Studio — GTA-style cover art from your own photos

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/sugarrush1932/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/sugarrush1932/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Ink Studio turns a person's own photographs and a caption into cover art
in the style of GTA 6's key art: a wall of photo panels with slanted seams, and
the lettering treated the way real key art treats it — as the hero. A giant
gradient display title is lettered *over* the panels, the neon script subtitle
tucks under its last line, and a five-star pull-quote rides above it. Every
panel is run through a print-shop ink engine, and every finished cover carries
the furniture of a printed poster: a starburst ORIGINAL seal, a tagline strip
with palm silhouettes and a setting sun, a credits microline, a barcode and the
studio's corner bug.

The house grade is **Vice Spectrum**: a seven-stop sunset spectrum — deep
purple shadows, violet and magenta mids, a hot pink heart, then orange, amber
and pale gold — mapped over each photo with a halftone screen, a soft bloom on
the highlights and a whisper of the photo's own colour kept back, so faces stay
luminous while the sky burns. **Neon Night** runs the spectrum into blue for
after-dark shots, and **Comic Ink** gives a newsprint punch. The studio's
signature is still **Palette Match**: it reads the dominant colours out of your
loaded photos and mixes a bespoke ink ramp from them, so a cover is printed in
the colours of the day the photos were taken.

## What it does

- **Any photo** — load several of your own photos (they are read on your machine
  and never uploaded), place each in any panel, drag to pan it, scroll to zoom,
  or use the quick actions: auto-centre a crop, fill every panel from one photo,
  or spread the photos across the panels.
- **Six layouts** — Key Art (the hero lockup, composed separately for wide,
  square and portrait sheets), Nine Grid, Hero Slant, Cover Story, Tilted
  Snapshots and Full Bleed, picked from thumbnail presets.
- **Eight ink grades** — Vice Spectrum, Sunset Ink, Neon Night, Neon Ink, Coast
  Ink, Comic Ink, Poster Pop and Newsprint, plus Palette Match and a clean
  colour grade. Five finishing sliders (ink strength, contrast, saturation,
  paper grain, vignette) and a halftone toggle tune the print after the ink.
- **Words and dressing** — title, script subtitle, tagline and pull-quote, a
  starburst seal, a five-star heat meter, paper or ink seams, and the poster
  furniture, which can be switched off for a bare print.
- **Post sizes** — 1080 × 1080, 1080 × 1350, 1920 × 1080 and a 1080 × 1920 story,
  exported as PNG one at a time or all sizes at once, with the saved file named
  in the status line. Undo and redo throughout.
- **Offline and deterministic** — the app is static files under `app/` with no
  build step and no network requests; every script, font and sample it loads
  ships inside it, and the same inputs always print the same cover.

The lettering faces are Anton and Pacifico, both under the SIL Open Font License
(their license texts sit beside them in `app/fonts/`). The sample photographs
were made with an image model and are free to use: they star the studio's own
two leads — Lucia (dark wavy hair, a mole beside her lip, gold hoop earrings)
and Jason (short dark hair, a scar through one eyebrow, stubble) — the same two
faces across one long Palm City day: her convertible at sunset, his neon gas
station and rain-slick night ride, the diner, her booking photo, a palm
boulevard and a boat wake in the Keys. No Rockstar Games logo, artwork or font
is used anywhere.

## Run it

```sh
node serve.ts            # serves app/ at http://localhost:8080
```

To hand the entry in the way the grader runs it:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=tencent-non&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
