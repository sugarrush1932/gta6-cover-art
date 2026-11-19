// ink.js — the Vice Ink print engine.
//
// Every photo panel of a cover is run through a print-shop treatment before it is
// composited: its tones are mapped through a multi-stop ink ramp (a gradient map),
// a halftone dot screen is bitten into the mid-tones and shadows, and a whisper of
// paper grain goes over the top. The result reads as illustrated poster art rather
// than a photograph, which is the whole look of a game cover.
//
// The house grade is Vice Spectrum: a seven-stop sunset spectrum — deep purple
// shadows, violet and magenta mids, a hot pink heart, then orange, amber and pale
// gold highlights — so a face stays luminous while the sky around it burns.
// Neon Night runs the same spectrum backwards into blue for after-dark shots, and
// Comic Ink posterises the tones under a heavy halftone screen for a newsprint
// punch. The older duotone inks (Sunset, Neon, Coast, Poster Pop, Newsprint) stay
// on the shelf, and Palette Match is still the studio's signature: it reads the
// dominant colours out of the loaded photos and mixes a bespoke ink ramp from
// them, so the cover is printed in the colours of the day the photos were taken.

/** The ink ramps, darkest ink first, paper last. Stops are [r, g, b]. */
export const INK_RAMPS = {
  spectrum: {
    label: 'Vice Spectrum',
    stops: [[26, 10, 46], [80, 18, 104], [156, 26, 118], [232, 52, 108], [255, 106, 58], [255, 172, 84], [255, 233, 183]],
    dot: 0.22,
    bloom: 0.3,
  },
  sunset: {
    label: 'Sunset Ink',
    stops: [[38, 16, 54], [122, 28, 84], [224, 65, 94], [255, 138, 61], [255, 224, 168]],
    dot: 0.55,
  },
  neonnight: {
    label: 'Neon Night',
    stops: [[6, 10, 36], [24, 22, 84], [72, 32, 150], [168, 36, 168], [255, 72, 168], [96, 205, 255], [226, 248, 255]],
    dot: 0.3,
    bloom: 0.34,
  },
  neon: {
    label: 'Neon Ink',
    stops: [[10, 10, 34], [58, 20, 110], [176, 32, 140], [240, 64, 170], [168, 246, 255]],
    dot: 0.5,
  },
  coast: {
    label: 'Coast Ink',
    stops: [[8, 38, 48], [12, 96, 104], [32, 168, 150], [240, 196, 96], [255, 240, 205]],
    dot: 0.45,
  },
  comic: {
    label: 'Comic Ink',
    stops: [[28, 12, 44], [110, 22, 92], [208, 38, 92], [248, 92, 52], [252, 178, 64], [252, 240, 205]],
    dot: 0.45,
  },
  pop: {
    label: 'Poster Pop',
    stops: [[16, 20, 58], [178, 30, 44], [240, 84, 40], [252, 176, 44], [252, 244, 214]],
    dot: 0.65,
  },
  mono: {
    label: 'Newsprint',
    stops: [[24, 20, 18], [74, 64, 58], [138, 126, 112], [198, 188, 172], [246, 240, 228]],
    dot: 0.7,
  },
};

/** The finishing controls every grade shares, at their resting values. */
export const DEFAULT_FX = {
  strength: 0.92,
  contrast: 0.06,
  saturation: 0.08,
  grain: 0.3,
  vignette: 0.5,
  halftone: true,
};

/** Builds a 256-entry lookup table that maps a luminance byte to an ink colour. */
export function buildRampLut(stops) {
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
    const f = t * (stops.length - 1) - seg;
    const a = stops[seg];
    const b = stops[seg + 1];
    lut[i * 3] = Math.round(a[0] + (b[0] - a[0]) * f);
    lut[i * 3 + 1] = Math.round(a[1] + (b[1] - a[1]) * f);
    lut[i * 3 + 2] = Math.round(a[2] + (b[2] - a[2]) * f);
  }
  return lut;
}

/**
 * Inks one panel in place: `data` is the ImageData of a photo already drawn at the
 * panel's pixel size. Tones go through the ramp (or stay photographic when `lut`
 * is null), a halftone screen is applied with cell size `dotCell` (in pixels), and
 * `hueKeep` (0..1) blends a little of the photo's own colour back in so skin and
 * sky do not go fully flat. `fx` carries the finishing sliders: strength mixes the
 * ink against the photo's own contrast-adjusted colours, contrast and saturation
 * shape both, and a ramp's `posterize` (when set) flattens the tones into bands.
 */
export function inkPixels(data, lut, dotStrength, dotCell, hueKeep, fx, posterize = 0) {
  const px = data.data;
  const w = data.width;
  const half = dotCell / 2;
  const strength = fx?.strength ?? 1;
  const contrast = fx?.contrast ?? 0;
  const saturation = fx?.saturation ?? 0;
  const contrastF = 1 + contrast;
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    let lum = (r * 77 + g * 150 + b * 29) >> 8;
    // A gentle print S-curve: deepen the shadows, keep the paper bright.
    lum = lum < 128
      ? Math.round((lum * lum) / 128)
      : 255 - Math.round(((255 - lum) * (255 - lum)) / 128);
    lum = Math.max(0, Math.min(255, Math.round((lum - 128) * contrastF + 128)));
    if (posterize > 1) {
      lum = Math.round((lum / 255) * (posterize - 1)) * (255 / (posterize - 1));
    }
    // The photo's own colours, contrast-shaped: what the ink is mixed against.
    let br = Math.max(0, Math.min(255, Math.round((r - 128) * contrastF + 128)));
    let bg = Math.max(0, Math.min(255, Math.round((g - 128) * contrastF + 128)));
    let bb = Math.max(0, Math.min(255, Math.round((b - 128) * contrastF + 128)));
    let nr;
    let ng;
    let nb;
    if (lut) {
      const li = Math.round(lum) * 3;
      nr = lut[li];
      ng = lut[li + 1];
      nb = lut[li + 2];
      if (hueKeep > 0) {
        nr = Math.round(nr + (r - nr) * hueKeep);
        ng = Math.round(ng + (g - ng) * hueKeep);
        nb = Math.round(nb + (b - nb) * hueKeep);
      }
      if (strength < 1) {
        nr = Math.round(br + (nr - br) * strength);
        ng = Math.round(bg + (ng - bg) * strength);
        nb = Math.round(bb + (nb - bb) * strength);
      }
    } else {
      nr = br;
      ng = bg;
      nb = bb;
    }
    if (saturation !== 0) {
      const grey = (nr * 77 + ng * 150 + nb * 29) >> 8;
      nr = Math.max(0, Math.min(255, Math.round(grey + (nr - grey) * (1 + saturation))));
      ng = Math.max(0, Math.min(255, Math.round(grey + (ng - grey) * (1 + saturation))));
      nb = Math.max(0, Math.min(255, Math.round(grey + (nb - grey) * (1 + saturation))));
    }
    if (dotStrength > 0) {
      const x = p % w;
      const y = (p / w) | 0;
      const dx = (x % dotCell) - half;
      const dy = (y % dotCell) - half;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const darkness = 1 - lum / 255;
      const dotRadius = half * (0.35 + darkness * 0.95);
      if (dist < dotRadius) {
        const bite = dotStrength * (0.35 + darkness * 0.45);
        nr = Math.round(nr * (1 - bite));
        ng = Math.round(ng * (1 - bite));
        nb = Math.round(nb * (1 - bite));
      }
    }
    px[i] = nr;
    px[i + 1] = ng;
    px[i + 2] = nb;
  }
  return data;
}

/** Converts one [h, s, l] triple (h in degrees, s and l in 0..1) to [r, g, b]. */
export function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255)];
}

/**
 * Palette Match: reads the loaded photos and mixes an ink ramp out of their own
 * dominant colours. Hue buckets are weighted by saturation, so a grey street does
 * not outvote a neon sign; the two strongest hues become the ramp's heart, the
 * photos' own darkest and lightest tones anchor its ends.
 */
export function matchPaletteFromPhotos(images) {
  const buckets = new Float32Array(24);
  let darkest = 255;
  let lightest = 0;
  const probe = document.createElement('canvas');
  probe.width = 24;
  probe.height = 24;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  for (const img of images) {
    if (!img) continue;
    pctx.drawImage(img, 0, 0, 24, 24);
    const data = pctx.getImageData(0, 0, 24, 24).data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 255);
      if (lum < darkest) darkest = lum;
      if (lum > lightest) lightest = lum;
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat < 0.12) continue;
      let hue;
      if (max === r) hue = ((g - b) / (max - min)) % 6;
      else if (max === g) hue = (b - r) / (max - min) + 2;
      else hue = (r - g) / (max - min) + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
      buckets[Math.floor(hue / 15) % 24] += sat;
    }
  }
  const order = [...buckets.keys()].sort((a, b) => buckets[b] - buckets[a]);
  const hueA = (order[0] + 0.5) * 15;
  let hueB = (order[1] + 0.5) * 15;
  if (Math.abs(hueA - hueB) < 30) hueB = (hueA + 150) % 360;
  const stops = [
    hslToRgb(hueA, 0.72, Math.max(0.05, (darkest / 255) * 0.16)),
    hslToRgb(hueA, 0.68, 0.27),
    hslToRgb(hueB, 0.74, 0.5),
    hslToRgb(hueA, 0.82, 0.7),
    hslToRgb((hueA + 40) % 360, 0.9, Math.min(0.95, 0.82 + (lightest / 255) * 0.13)),
  ];
  return { label: 'Palette Match', stops, dot: 0.5, bloom: 0.26 };
}

/** A deterministic seeded random source, so every render of a cover is identical. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds the reusable paper-grain tile: soft noise, drawn over a cover at low alpha. */
export function buildGrainTile(seed) {
  const tile = document.createElement('canvas');
  tile.width = 256;
  tile.height = 256;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(256, 256);
  const rand = seededRandom(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.floor(rand() * 96);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  return tile;
}
