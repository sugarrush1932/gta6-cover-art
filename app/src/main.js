// main.js — wires the Vice Ink Studio editor.
//
// The state is one small object: the words, the dressing, the chosen layout, ink
// grade and post size, and one placement per panel (which photo fills it, its
// zoom and pan). Every control edits the state and re-renders; committed edits go
// on an undo stack. The canvas is always rendered at the full export size, so
// what you see is byte-for-byte the PNG you get.

import { INK_RAMPS, buildGrainTile, matchPaletteFromPhotos, seededRandom } from './ink.js';
import { LAYOUTS, buildLayout, pointInPolygon, polygonBox } from './layouts.js';
import { renderCover, tracePolygon } from './cover.js';
import { runShot } from './shots.js';

/** The post sizes the studio exports, the three common ones plus a story. */
const SIZES = [
  { id: 'square', label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
  { id: 'story', label: 'Story · 1080 × 1920', w: 1080, h: 1920 },
];

/**
 * The sample photographs bundled with the studio, each with its resting focus.
 * They star the studio's two leads — Lucia and Jason — across their signature
 * setups, with the Keys captain along for local colour, so a cover made from
 * the samples alone already reads as a Palm City key-art collage.
 */
const SAMPLES = [
  { name: 'Lucia', src: 'samples/lucia-car.jpg', x: 0.52, y: 0.27 },
  { name: 'Jason', src: 'samples/jason-neon.jpg', x: 0.55, y: 0.30 },
  { name: 'Lucia & Jason', src: 'samples/duo-diner.jpg', x: 0.50, y: 0.40 },
  { name: 'The Captain', src: 'samples/captain.jpg', x: 0.50, y: 0.32 },
  { name: 'Jason, Close', src: 'samples/jason-close.jpg', x: 0.50, y: 0.45 },
  { name: 'The Mugshot', src: 'samples/lucia-mugshot.jpg', x: 0.45, y: 0.30 },
  { name: 'The Keys', src: 'samples/jason-keys.jpg', x: 0.38, y: 0.38 },
];

const canvas = document.getElementById('cover');
const status = document.getElementById('status');

const state = {
  layout: 'keyart',
  grade: 'sunset',
  caption: 'Palm City',
  subtitle: 'neon hearts',
  tagline: 'One city. Every light tells a story.',
  badge: 'est',
  heat: 4,
  frame: 'paper',
  size: 'portrait',
  panels: {},
};

const photos = [];
let layout = null;
let selectedPanel = null;
let exactSize = null;
const view = { grainTile: buildGrainTile(20261119), matchedRamp: null, rand: seededRandom(99) };
let matchStale = true;

/** The canvas size in force: the chosen post size, or a scene's exact pixels. */
function currentSize() {
  if (exactSize) return exactSize;
  return SIZES.find((s) => s.id === state.size) ?? SIZES[1];
}

/** Every addressable panel of the current layout, snapshots' cards included. */
function panelEntries() {
  if (!layout) return [];
  const entries = layout.panels.map((def) => ({ id: def.id, label: def.label, def }));
  if (layout.cards) {
    layout.cards.forEach((card, i) => {
      entries.push({ id: `card-${i}`, label: `Snapshot ${i + 1}`, card });
    });
  }
  return entries;
}

/** Gives every panel of the current layout a placement, keeping existing ones. */
function ensurePanelStates() {
  if (!layout) return;
  for (const def of layout.panels) {
    if (!state.panels[def.id]) {
      state.panels[def.id] = { photo: Math.min(def.photo, photos.length - 1), zoom: 1, ox: 0, oy: 0 };
    }
  }
  if (layout.cards) {
    layout.cards.forEach((card, i) => {
      const id = `card-${i}`;
      if (!state.panels[id]) {
        state.panels[id] = { photo: Math.min(card.photo, photos.length - 1), zoom: 1, ox: 0, oy: 0 };
      }
    });
  }
  const entries = panelEntries();
  if (!entries.some((e) => e.id === selectedPanel)) {
    selectedPanel = entries[0]?.id ?? null;
  }
}

/** Rebuilds the layout for the size in force and re-renders the cover. */
function redraw() {
  const size = currentSize();
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  layout = buildLayout(state.layout, size.w / size.h);
  ensurePanelStates();
  if (state.grade === 'match' && matchStale) {
    view.matchedRamp = matchPaletteFromPhotos(photos.map((p) => p.img));
    matchStale = false;
  }
  view.rand = seededRandom(99);
  renderCover(canvas, layout, state, photos, view);
  drawSelection();
  refreshControls();
}

/** Outlines the selected panel on the editor's canvas (never on an export). */
function drawSelection() {
  if (document.body.classList.contains('shot-cover') || !selectedPanel) return;
  const entry = panelEntries().find((e) => e.id === selectedPanel);
  if (!entry?.def) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  tracePolygon(ctx, entry.def.poly, canvas.width, canvas.height);
  ctx.setLineDash([canvas.width * 0.012, canvas.width * 0.008]);
  ctx.lineWidth = Math.max(3, canvas.width * 0.004);
  ctx.strokeStyle = '#ffd23c';
  ctx.stroke();
  ctx.restore();
}

/** Loads an image from a URL, resolving once it can be drawn. */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Loads the bundled sample photographs into the photo strip. */
async function loadSamples() {
  for (const sample of SAMPLES) {
    const img = await loadImage(sample.src);
    photos.push({ img, x: sample.x, y: sample.y, name: sample.name, thumb: sample.src });
  }
}

/** Adds a person's own photographs, read on this machine and never uploaded. */
async function addUserPhotos(files) {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    photos.push({ img, x: 0.5, y: 0.4, name: 'My photo', thumb: url });
  }
  matchStale = true;
  buildPhotoStrip();
  redraw();
  status.textContent = `${photos.length} photos in the studio.`;
}

/* ————— history ————— */

const undoStack = [];
const redoStack = [];

function commit() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
}

function restore(json) {
  Object.assign(state, JSON.parse(json));
  exactSize = null;
  matchStale = true;
  syncWordInputs();
  redraw();
}

document.getElementById('undo').addEventListener('click', () => {
  if (undoStack.length < 2) return;
  redoStack.push(undoStack.pop());
  restore(undoStack[undoStack.length - 1]);
});

document.getElementById('redo').addEventListener('click', () => {
  if (redoStack.length === 0) return;
  const next = redoStack.pop();
  undoStack.push(next);
  restore(next);
});

/* ————— controls ————— */

function chip(parent, label, active, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label;
  if (active) btn.classList.add('active');
  btn.addEventListener('click', onClick);
  parent.appendChild(btn);
  return btn;
}

function buildPhotoStrip() {
  const strip = document.getElementById('photo-strip');
  strip.replaceChildren();
  photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const img = document.createElement('img');
    img.src = photo.thumb;
    img.alt = photo.name;
    const tag = document.createElement('span');
    tag.textContent = String(i + 1);
    btn.append(img, tag);
    const slot = selectedPanel ? state.panels[selectedPanel] : null;
    if (slot && slot.photo === i) btn.classList.add('active');
    btn.addEventListener('click', () => {
      if (!selectedPanel) return;
      state.panels[selectedPanel].photo = i;
      commit();
      buildPhotoStrip();
      redraw();
    });
    strip.appendChild(btn);
  });
}

function buildPanelList() {
  const list = document.getElementById('panel-list');
  list.replaceChildren();
  for (const entry of panelEntries()) {
    chip(list, entry.label, entry.id === selectedPanel, () => selectPanel(entry.id));
  }
}

function buildChoiceRows() {
  const layoutRow = document.getElementById('layout-row');
  layoutRow.replaceChildren();
  for (const item of LAYOUTS) {
    chip(layoutRow, item.label, state.layout === item.id, () => {
      state.layout = item.id;
      commit();
      redraw();
    });
  }
  const gradeRow = document.getElementById('grade-row');
  gradeRow.replaceChildren();
  for (const [key, ramp] of Object.entries(INK_RAMPS)) {
    chip(gradeRow, ramp.label, state.grade === key, () => {
      state.grade = key;
      commit();
      redraw();
    });
  }
  const sizeRow = document.getElementById('size-row');
  sizeRow.replaceChildren();
  for (const size of SIZES) {
    chip(sizeRow, size.label, state.size === size.id && !exactSize, () => {
      state.size = size.id;
      exactSize = null;
      commit();
      redraw();
    });
  }
  document.getElementById('match').classList.toggle('active', state.grade === 'match');
  const stars = document.getElementById('heat-stars');
  stars.replaceChildren();
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '★';
    if (i <= state.heat) btn.classList.add('lit');
    btn.addEventListener('click', () => {
      state.heat = state.heat === i ? 0 : i;
      commit();
      redraw();
    });
    stars.appendChild(btn);
  }
}

function refreshControls() {
  buildPanelList();
  buildChoiceRows();
  buildPhotoStrip();
  const slot = selectedPanel ? state.panels[selectedPanel] : null;
  const zoom = document.getElementById('zoom');
  if (slot) zoom.value = String(slot.zoom);
}

function selectPanel(id) {
  selectedPanel = id;
  redraw();
}

function syncWordInputs() {
  document.getElementById('caption').value = state.caption;
  document.getElementById('subtitle').value = state.subtitle;
  document.getElementById('tagline').value = state.tagline;
  document.getElementById('badge').value = state.badge;
  document.getElementById('frame').value = state.frame;
}

for (const [id, key] of [['caption', 'caption'], ['subtitle', 'subtitle'], ['tagline', 'tagline']]) {
  const input = document.getElementById(id);
  input.addEventListener('input', () => {
    state[key] = input.value;
    redraw();
  });
  input.addEventListener('change', commit);
}

document.getElementById('badge').addEventListener('change', (e) => {
  state.badge = e.target.value;
  commit();
  redraw();
});

document.getElementById('frame').addEventListener('change', (e) => {
  state.frame = e.target.value;
  commit();
  redraw();
});

document.getElementById('match').addEventListener('click', () => {
  state.grade = state.grade === 'match' ? 'sunset' : 'match';
  matchStale = true;
  commit();
  redraw();
});

document.getElementById('zoom').addEventListener('input', (e) => {
  const slot = selectedPanel ? state.panels[selectedPanel] : null;
  if (!slot) return;
  slot.zoom = Number(e.target.value);
  redraw();
});
document.getElementById('zoom').addEventListener('change', commit);

document.getElementById('files').addEventListener('change', (e) => {
  if (e.target.files.length > 0) addUserPhotos([...e.target.files]);
});

/* ————— canvas gestures: tap to select, drag to pan, scroll to zoom ————— */

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function panelAt(point) {
  const ux = point.x / canvas.width;
  const uy = point.y / canvas.height;
  for (const entry of panelEntries()) {
    if (entry.def && pointInPolygon(ux, uy, entry.def.poly)) return entry;
  }
  return null;
}

let drag = null;

canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const entry = panelAt(point);
  if (!entry) return;
  selectedPanel = entry.id;
  const slot = state.panels[entry.id];
  drag = { id: entry.id, startX: point.x, startY: point.y, ox: slot.ox, oy: slot.oy, moved: false };
  canvas.setPointerCapture(event.pointerId);
  redraw();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = canvasPoint(event);
  const entry = panelEntries().find((e) => e.id === drag.id);
  const slot = state.panels[drag.id];
  if (!entry?.def || !slot) return;
  const unit = polygonBox(entry.def.poly);
  const boxW = unit.w * canvas.width;
  const boxH = unit.h * canvas.height;
  slot.ox = drag.ox + (point.x - drag.startX) / Math.max(1, boxW);
  slot.oy = drag.oy + (point.y - drag.startY) / Math.max(1, boxH);
  drag.moved = true;
  redraw();
});

canvas.addEventListener('pointerup', () => {
  if (drag?.moved) commit();
  drag = null;
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const entry = panelAt(canvasPoint(event));
  if (!entry) return;
  selectedPanel = entry.id;
  const slot = state.panels[entry.id];
  slot.zoom = Math.min(3, Math.max(1, slot.zoom * Math.exp(-event.deltaY * 0.0012)));
  redraw();
}, { passive: false });

/* ————— export ————— */

function downloadCover(w, h) {
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-ink-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved vice-ink-cover-${w}x${h}.png`;
  }, 'image/png');
}

document.getElementById('export').addEventListener('click', () => {
  const size = currentSize();
  const keep = selectedPanel;
  selectedPanel = null;
  renderCover(canvas, layout, state, photos, view);
  downloadCover(size.w, size.h);
  selectedPanel = keep;
  redraw();
});

document.getElementById('export-all').addEventListener('click', async () => {
  const keepSize = state.size;
  const keepExact = exactSize;
  const keep = selectedPanel;
  selectedPanel = null;
  for (const size of SIZES) {
    exactSize = { ...size };
    redraw();
    downloadCover(size.w, size.h);
    await new Promise((r) => setTimeout(r, 350));
  }
  state.size = keepSize;
  exactSize = keepExact;
  selectedPanel = keep;
  redraw();
});

/* ————— fonts and boot ————— */

/** Loads the studio's two display faces from its own files, no network needed. */
async function loadStudioFonts() {
  const faces = [
    new FontFace('Anton', "url('./fonts/Anton-Regular.ttf')"),
    new FontFace('Pacifico', "url('./fonts/Pacifico-Regular.ttf')"),
  ];
  for (const face of faces) {
    document.fonts.add(await face.load());
  }
}

const api = {
  state,
  photos,
  canvas,
  panelEntries,
  selectPanel,
  redraw,
  setSize(id) {
    state.size = id;
    exactSize = null;
  },
  setExactSize(w, h) {
    exactSize = { id: 'exact', label: `${w} × ${h}`, w, h };
  },
};

await loadStudioFonts().catch(() => {});
await loadSamples();
buildPhotoStrip();
commit();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  await runShot(shot, new URLSearchParams(location.search), api);
} else {
  redraw();
}
