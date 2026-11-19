# Vice Ink Studio — GTA-style cover art from your own photos

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/sugarrush1932/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/sugarrush1932/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Ink Studio turns a person's own photographs and a caption into cover art in
the style of GTA 6's posters: a multi-panel sheet with slanted seams, every panel
run through a print-shop ink treatment (a five-stop gradient map with a halftone
screen bitten into the shadows), and a designed title block — a letterspaced
kicker, the caption in big gradient display type with a hard offset shade, a neon
script subtitle, a skyline of lit windows, heat stars and a starburst badge.

Its signature is **Palette Match**: the studio reads the dominant colours out of
your loaded photos and mixes a bespoke ink ramp from them, so a cover is printed
in the colours of the day the photos were taken.

## What it does

- **Any photo** — load several of your own photos (they are read on your machine
  and never uploaded), place each in any panel, drag to pan it and scroll to zoom.
- **Six layouts** — Key Art, Nine Grid, Hero Slant, Cover Story, Tilted Snapshots
  and Full Bleed, each composed for the chosen aspect.
- **Six ink grades** — Sunset Ink, Neon Ink, Coast Ink, Poster Pop, Newsprint and
  a clean colour grade, plus Palette Match.
- **Words and dressing** — title, script subtitle and tagline, a starburst badge
  and a five-star heat meter.
- **Post sizes** — 1080 × 1080, 1080 × 1350, 1920 × 1080 and a 1080 × 1920 story,
  exported as PNG one at a time or all at once. Undo and redo throughout.
- **Offline** — the app is static files under `app/` with no build step; every
  script, font and sample it loads ships inside it.

The lettering faces are Anton and Pacifico, both under the SIL Open Font License
(their license texts sit beside them in `app/fonts/`). The sample photographs
were made with an image model and are free to use: they star the studio's own
two leads — Lucia and Jason — in their signature setups (the boulevard hero
shot, the diner at night, her mugshot, his Keys pickup) with the Keys captain
along for local colour, so even the bundled samples compose into a cover that
reads as Palm City key art. No Rockstar Games logo, artwork or font is used
anywhere.

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
