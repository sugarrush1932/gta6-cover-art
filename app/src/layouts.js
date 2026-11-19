// layouts.js — the cover compositions of Vice Ink Studio.
//
// A layout is a set of photo panels (polygons in unit space, so one design serves
// every post size) plus a title block. The studio's signature is the slanted seam:
// vertical panel edges lean by a shear that grows with depth, the way the panels of
// a real game cover lean into the street. Panels are numbered in reading order and
// the first is always the hero.

/** Applies the cover shear: x leans further left the lower a point sits. */
function shearPoint(x, y, slant) {
  return [x + (0.5 - y) * slant, y];
}

/** A grid cell as a sheared polygon. Coordinates are fractions of the cover. */
function cell(x0, y0, x1, y1, slant) {
  return [
    shearPoint(x0, y0, slant),
    shearPoint(x1, y0, slant),
    shearPoint(x1, y1, slant),
    shearPoint(x0, y1, slant),
  ];
}

/** One photo panel: its polygon, a reading label and its default photo slot. */
function panel(id, label, poly, photo) {
  return { id, label, poly, photo, kind: 'photo' };
}

/**
 * The Key Art composition: a wall of panels with the title lettered over them.
 * The hero takes the left, a face and a coastline stack at the top right, and
 * the giant title lockup sits across the middle of the sheet, overlapping the
 * panels the way real key art stacks its lettering over the art. The foot of
 * the sheet is left to the furniture strip every cover carries.
 */
function keyArtLayout(aspect) {
  const slant = 0.03;
  if (aspect >= 1.15) {
    return {
      panels: [
        panel('hero', 'Hero', cell(0, 0, 0.545, 1, slant), 0),
        panel('face', 'Panel 2', cell(0.56, 0, 0.795, 0.44, slant), 4),
        panel('coast', 'Panel 3', cell(0.81, 0, 1, 0.44, slant), 3),
        panel('mid', 'Panel 4', cell(0.56, 0.455, 1, 0.75, slant), 1),
        panel('low-a', 'Panel 5', cell(0.56, 0.765, 0.79, 1, slant), 2),
        panel('low-b', 'Panel 6', cell(0.805, 0.765, 1, 1, slant), 6),
      ],
      title: { kind: 'hero', cx: 0.5, top: 0.475, maxW: 0.95, start: 0.30, lines: 1, seal: { x: 0.905, y: 0.15 } },
    };
  }
  if (aspect >= 0.85) {
    return {
      panels: [
        panel('top-a', 'Hero', cell(0, 0, 0.40, 0.36, slant), 7),
        panel('top-b', 'Panel 2', cell(0.415, 0, 0.70, 0.36, slant), 0),
        panel('top-c', 'Panel 3', cell(0.715, 0, 1, 0.36, slant), 2),
        panel('mid-a', 'Panel 4', cell(0, 0.375, 0.60, 0.685, slant), 6),
        panel('face', 'Panel 5', cell(0.615, 0.375, 1, 0.685, slant), 4),
        panel('bot-a', 'Panel 6', cell(0, 0.70, 0.33, 0.875, slant), 3),
        panel('bot-b', 'Panel 7', cell(0.345, 0.70, 0.66, 0.875, slant), 5),
        panel('bot-c', 'Panel 8', cell(0.675, 0.70, 1, 0.875, slant), 1),
      ],
      title: { kind: 'hero', cx: 0.5, top: 0.40, maxW: 0.96, start: 0.20, lines: 2, seal: { x: 0.135, y: 0.46 } },
    };
  }
  return {
    panels: [
      panel('face', 'Hero', cell(0, 0, 0.63, 0.52, slant), 4),
      panel('top-r', 'Panel 2', cell(0.645, 0, 1, 0.26, slant), 0),
      panel('mid-r', 'Panel 3', cell(0.645, 0.275, 1, 0.52, slant), 2),
      panel('mid-a', 'Panel 4', cell(0, 0.535, 0.49, 0.72, slant), 1),
      panel('mid-b', 'Panel 5', cell(0.51, 0.535, 1, 0.72, slant), 6),
      panel('bot-a', 'Panel 6', cell(0, 0.735, 0.33, 0.875, slant), 5),
      panel('bot-b', 'Panel 7', cell(0.345, 0.735, 0.66, 0.875, slant), 3),
      panel('bot-c', 'Panel 8', cell(0.675, 0.735, 1, 0.875, slant), 7),
    ],
    title: { kind: 'hero', cx: 0.5, top: 0.45, maxW: 0.96, start: 0.175, lines: 2, seal: { x: 0.815, y: 0.505 } },
  };
}

/** The Nine Grid: a three-by-three wall of panels with the title in the corner cell. */
function nineGridLayout(aspect) {
  const slant = 0.02;
  const panels = [];
  if (aspect >= 0.85) {
    const cells = [
      [0, 0], [1, 0], [2, 0],
      [0, 1], [1, 1], [2, 1],
      [0, 2], [1, 2],
    ];
    cells.forEach(([c, r], i) => {
      panels.push(panel(`g${i}`, i === 0 ? 'Hero' : `Panel ${i + 1}`,
        cell(c / 3 + 0.006, r / 3 + 0.006, (c + 1) / 3 - 0.006, (r + 1) / 3 - 0.006, slant), i % 4));
    });
    return { panels, title: { kind: 'block', x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 } };
  }
  const cells = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]];
  cells.forEach(([c, r], i) => {
    panels.push(panel(`g${i}`, i === 0 ? 'Hero' : `Panel ${i + 1}`,
      cell(c / 2 + 0.006, r / 4 + 0.005, (c + 1) / 2 - 0.006, (r + 1) / 4 - 0.005, slant), i % 4));
  });
  return { panels, title: { kind: 'block', x: 0, y: 0.75, w: 1, h: 0.25 } };
}

/** Full Bleed: one photograph takes the whole cover; the title rides a scrim at its foot. */
function fullBleedLayout(aspect) {
  return {
    panels: [
      panel('hero', 'Hero', [[0, 0], [1, 0], [1, 1], [0, 1]], 0),
      panel('inset', 'Inset', aspect >= 0.85
        ? [[0.715, 0.045], [0.965, 0.045], [0.965, 0.335], [0.715, 0.335]]
        : [[0.60, 0.04], [0.96, 0.04], [0.96, 0.26], [0.60, 0.26]], 1),
    ],
    title: { kind: 'overlay', x: 0.045, y: aspect >= 0.85 ? 0.60 : 0.66, w: 0.91, h: aspect >= 0.85 ? 0.36 : 0.30 },
  };
}

/** Hero Slant: one big parallelogram, two leaning companions, the title at the hero's foot. */
function heroSlantLayout(aspect) {
  if (aspect < 0.85) {
    return {
      panels: [
        panel('hero', 'Hero', [[0, 0], [1, 0], [0.94, 0.46], [0, 0.46]], 0),
        panel('low-a', 'Panel 2', [[0, 0.475], [0.485, 0.475], [0.455, 0.72], [0, 0.72]], 1),
        panel('low-b', 'Panel 3', [[0.515, 0.475], [1, 0.475], [1, 0.72], [0.485, 0.72]], 2),
      ],
      title: { kind: 'block', x: 0, y: 0.735, w: 1, h: 0.265 },
    };
  }
  return {
    panels: [
      panel('hero', 'Hero', [[0, 0], [0.60, 0], [0.51, 1], [0, 1]], 0),
      panel('top-r', 'Panel 2', [[0.635, 0], [1, 0], [1, 0.475], [0.575, 0.475]], 1),
      panel('bot-r', 'Panel 3', [[0.565, 0.525], [1, 0.525], [1, 1], [0.545, 1]], 2),
    ],
    title: { kind: 'overlay', x: 0.035, y: 0.615, w: 0.44, h: 0.35 },
  };
}

/** Tilted Snapshots: inked backdrop, three framed photographs thrown down at angles. */
function tiltedSnapshotsLayout(aspect) {
  const wide = aspect >= 0.85;
  return {
    panels: [panel('backdrop', 'Backdrop', [[0, 0], [1, 0], [1, 1], [0, 1]], 3)],
    cards: wide
      ? [
          { photo: 0, cx: 0.335, cy: 0.46, w: 0.46, h: 0.62, rot: -0.055 },
          { photo: 1, cx: 0.665, cy: 0.40, w: 0.40, h: 0.54, rot: 0.075 },
          { photo: 2, cx: 0.60, cy: 0.76, w: 0.44, h: 0.40, rot: -0.028 },
        ]
      : [
          { photo: 0, cx: 0.5, cy: 0.335, w: 0.72, h: 0.42, rot: -0.045 },
          { photo: 1, cx: 0.36, cy: 0.635, w: 0.56, h: 0.33, rot: 0.06 },
          { photo: 2, cx: 0.64, cy: 0.85, w: 0.58, h: 0.27, rot: -0.02 },
        ],
    title: { kind: 'masthead', x: 0.04, y: 0.025, w: 0.92, h: 0.20 },
  };
}

/** Cover Story: a magazine masthead over a hero shot and a strip of panels. */
function coverStoryLayout(aspect) {
  const slant = 0.025;
  if (aspect < 0.85) {
    return {
      panels: [
        panel('hero', 'Hero', cell(0, 0.155, 1, 0.66, slant), 0),
        panel('low-a', 'Panel 2', cell(0, 0.675, 0.49, 1, slant), 1),
        panel('low-b', 'Panel 3', cell(0.51, 0.675, 1, 1, slant), 2),
      ],
      title: { kind: 'masthead', x: 0, y: 0, w: 1, h: 0.145 },
    };
  }
  return {
    panels: [
      panel('hero', 'Hero', cell(0, 0.17, 1, 0.70, slant), 0),
      panel('low-a', 'Panel 2', cell(0, 0.715, 0.325, 1, slant), 1),
      panel('low-b', 'Panel 3', cell(0.34, 0.715, 0.66, 1, slant), 2),
      panel('low-c', 'Panel 4', cell(0.675, 0.715, 1, 1, slant), 3),
    ],
    title: { kind: 'masthead', x: 0, y: 0, w: 1, h: 0.155 },
  };
}

/** Every composition the studio offers, in the order the editor shows them. */
export const LAYOUTS = [
  { id: 'keyart', label: 'Key Art', build: keyArtLayout },
  { id: 'nine', label: 'Nine Grid', build: nineGridLayout },
  { id: 'slant', label: 'Hero Slant', build: heroSlantLayout },
  { id: 'story', label: 'Cover Story', build: coverStoryLayout },
  { id: 'snapshots', label: 'Tilted Snapshots', build: tiltedSnapshotsLayout },
  { id: 'bleed', label: 'Full Bleed', build: fullBleedLayout },
];

/** Builds one layout for a canvas aspect (width / height). */
export function buildLayout(id, aspect) {
  const found = LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
  return found.build(aspect);
}

/** The axis-aligned box a polygon's photo is fitted into. */
export function polygonBox(poly) {
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** True when the unit point (x, y) falls inside a panel polygon. */
export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
