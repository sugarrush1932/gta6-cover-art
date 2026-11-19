// cover.js — draws a finished Vice Ink cover onto a canvas.
//
// The pipeline: every photo panel is fitted into its (possibly slanted) polygon,
// inked by the print engine, and stroked with the frame colour so the seams read
// as one printed sheet; then the title block is lettered over the top — a kicker,
// the caption in big gradient display type with a hard offset shade, a neon script
// subtitle tucked under it, heat stars and a tagline — and the whole sheet gets
// paper grain, a vignette and, if the cover asks for it, a starburst badge.

import { INK_RAMPS, buildRampLut, inkPixels } from './ink.js';
import { polygonBox } from './layouts.js';

/** How much of a photo's own colour survives its ink, per grade. */
const HUE_KEEP = { sunset: 0.12, neon: 0.1, coast: 0.16, pop: 0.05, mono: 0, match: 0.12, clean: 0 };

/** Resolves the state's grade choice to a concrete ramp ({ stops, dot }). */
export function resolveRamp(state, matchedRamp) {
  if (state.grade === 'match' && matchedRamp) return matchedRamp;
  if (state.grade === 'clean') return null;
  return INK_RAMPS[state.grade] ?? INK_RAMPS.sunset;
}

/** Traces a unit-space polygon onto a context scaled to (w, h). */
export function tracePolygon(ctx, poly, w, h) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x * w, y * h);
    else ctx.lineTo(x * w, y * h);
  });
  ctx.closePath();
}

/** Fits a photo into a box: cover-fit, a focus point, the panel's pan and zoom. */
function photoPlacement(img, box, focus, pan) {
  const scale0 = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const scale = scale0 * (pan?.zoom ?? 1);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  let x = box.x - (dw - box.w) * (focus?.x ?? 0.5) + (pan?.ox ?? 0) * box.w;
  let y = box.y - (dh - box.h) * (focus?.y ?? 0.5) + (pan?.oy ?? 0) * box.h;
  x = Math.min(box.x, Math.max(box.x - (dw - box.w), x));
  y = Math.min(box.y, Math.max(box.y - (dh - box.h), y));
  return { x, y, w: dw, h: dh };
}

const scratch = document.createElement('canvas');

/**
 * Draws one photo panel: the fitted photo is inked on a scratch canvas, clipped
 * to the panel's polygon, and the seam is stroked over it.
 */
function drawPhotoPanel(ctx, w, h, panelDef, photo, pan, view) {
  const unit = polygonBox(panelDef.poly);
  const box = { x: unit.x * w, y: unit.y * h, w: unit.w * w, h: unit.h * h };
  if (!photo) {
    tracePolygon(ctx, panelDef.poly, w, h);
    ctx.fillStyle = '#241a38';
    ctx.fill();
    ctx.strokeStyle = view.frameColour;
    ctx.lineWidth = view.gutter;
    ctx.stroke();
    return;
  }
  scratch.width = Math.max(2, Math.round(box.w));
  scratch.height = Math.max(2, Math.round(box.h));
  const sctx = scratch.getContext('2d', { willReadFrequently: true });
  const place = photoPlacement(photo.img, { x: 0, y: 0, w: scratch.width, h: scratch.height }, photo, pan);
  sctx.drawImage(photo.img, place.x, place.y, place.w, place.h);
  if (view.ramp) {
    const data = sctx.getImageData(0, 0, scratch.width, scratch.height);
    inkPixels(data, view.lut, view.ramp.dot, view.dotCell, HUE_KEEP[view.state.grade] ?? 0.1);
    sctx.putImageData(data, 0, 0);
  } else {
    const tint = sctx.createLinearGradient(0, 0, 0, scratch.height);
    tint.addColorStop(0, 'rgba(255, 150, 70, 0.10)');
    tint.addColorStop(1, 'rgba(190, 30, 110, 0.20)');
    sctx.globalCompositeOperation = 'soft-light';
    sctx.fillStyle = tint;
    sctx.fillRect(0, 0, scratch.width, scratch.height);
    sctx.globalCompositeOperation = 'source-over';
  }
  ctx.save();
  tracePolygon(ctx, panelDef.poly, w, h);
  ctx.clip();
  ctx.drawImage(scratch, box.x, box.y);
  ctx.restore();
  tracePolygon(ctx, panelDef.poly, w, h);
  ctx.strokeStyle = view.frameColour;
  ctx.lineWidth = view.gutter;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Draws one tilted snapshot card: a white-framed, inked photo thrown at an angle. */
function drawSnapshotCard(ctx, w, h, card, photo, view) {
  const cw = card.w * w;
  const ch = card.h * h;
  ctx.save();
  ctx.translate(card.cx * w, card.cy * h);
  ctx.rotate(card.rot);
  ctx.shadowColor = 'rgba(5, 2, 12, 0.55)';
  ctx.shadowBlur = Math.min(w, h) * 0.03;
  ctx.shadowOffsetY = Math.min(w, h) * 0.012;
  ctx.fillStyle = '#f7f1e3';
  ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
  ctx.shadowColor = 'transparent';
  const frame = cw * 0.045;
  const foot = ch * 0.16;
  if (photo) {
    scratch.width = Math.max(2, Math.round(cw - frame * 2));
    scratch.height = Math.max(2, Math.round(ch - frame - foot));
    const sctx = scratch.getContext('2d', { willReadFrequently: true });
    const place = photoPlacement(photo.img, { x: 0, y: 0, w: scratch.width, h: scratch.height }, photo, null);
    sctx.drawImage(photo.img, place.x, place.y, place.w, place.h);
    if (view.ramp) {
      const data = sctx.getImageData(0, 0, scratch.width, scratch.height);
      inkPixels(data, view.lut, view.ramp.dot, view.dotCell, HUE_KEEP[view.state.grade] ?? 0.1);
      sctx.putImageData(data, 0, 0);
    }
    ctx.drawImage(scratch, -cw / 2 + frame, -ch / 2 + frame);
  }
  ctx.restore();
}

/** A five-point star path centred on (cx, cy). */
function traceStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** The heat meter: five stars, `heat` of them lit. */
function drawHeatStars(ctx, x, y, size, heat, align = 'left') {
  const total = size * 5.6;
  const startX = align === 'center' ? x - total / 2 + size / 2 : x + size / 2;
  for (let i = 0; i < 5; i++) {
    traceStar(ctx, startX + i * size * 1.15, y, size / 2);
    if (i < heat) {
      ctx.fillStyle = '#ffc93c';
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 220, 130, 0.85)';
    ctx.lineWidth = size * 0.07;
    ctx.stroke();
  }
}

/** A skyline of rooftops and lit windows along a baseline, from a seeded source. */
function drawSkyline(ctx, x, y, w, maxH, rand, colour) {
  ctx.fillStyle = colour;
  let cx = x;
  while (cx < x + w) {
    const bw = w * (0.03 + rand() * 0.05);
    const bh = maxH * (0.35 + rand() * 0.65);
    ctx.fillRect(cx, y - bh, bw, bh);
    if (rand() > 0.55) ctx.fillRect(cx + bw * 0.3, y - bh - maxH * 0.12, bw * 0.4, maxH * 0.12);
    ctx.fillStyle = 'rgba(255, 196, 92, 0.85)';
    const rows = Math.floor(bh / (maxH * 0.16));
    for (let r = 0; r < rows; r++) {
      for (let cix = 0; cix < 3; cix++) {
        if (rand() > 0.55) {
          ctx.fillRect(cx + bw * (0.16 + cix * 0.28), y - bh + maxH * 0.08 + r * maxH * 0.16, bw * 0.13, maxH * 0.06);
        }
      }
    }
    ctx.fillStyle = colour;
    cx += bw + w * 0.006;
  }
}

/** Fits the caption into a block: one line if it can, else two balanced lines. */
function fitTitleLines(ctx, text, maxW, maxH, startSize) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [], size: startSize };
  const fits = (lines, size) => {
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    return lines.every((line) => ctx.measureText(line).width <= maxW) && lines.length * size * 1.02 <= maxH;
  };
  let size = startSize;
  if (words.length > 1) {
    let best = null;
    for (let cut = 1; cut < words.length; cut++) {
      const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
      let s = startSize;
      while (s > 10 && !fits(lines, s)) s -= 2;
      if (fits(lines, s) && (!best || s > best.size)) best = { lines, size: s };
    }
    let single = startSize;
    while (single > 10 && !fits([text], single)) single -= 2;
    if (fits([text], single) && single >= (best?.size ?? 0)) return { lines: [text], size: single };
    if (best) return best;
  }
  while (size > 10 && !fits([text], size)) size -= 2;
  return { lines: [text], size };
}

/** Letters one fitted title: hard offset shade, ink-dark outline, gradient face. */
function drawTitleText(ctx, lines, size, cx, topY, ramp) {
  if (lines.length === 0) return 0;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const lineH = size * 1.02;
  lines.forEach((line, i) => {
    const y = topY + i * lineH;
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    const grad = ctx.createLinearGradient(0, y, 0, y + size);
    const stops = ramp ? ramp.stops : INK_RAMPS.sunset.stops;
    grad.addColorStop(0, `rgb(${stops[4][0]}, ${stops[4][1]}, ${stops[4][2]})`);
    grad.addColorStop(0.55, `rgb(${stops[3][0]}, ${stops[3][1]}, ${stops[3][2]})`);
    grad.addColorStop(1, `rgb(${stops[2][0]}, ${stops[2][1]}, ${stops[2][2]})`);
    ctx.fillStyle = 'rgba(16, 6, 26, 0.9)';
    ctx.fillText(line, cx + size * 0.05, y + size * 0.055);
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = '#1c0b2e';
    ctx.strokeText(line, cx, y);
    ctx.fillStyle = grad;
    ctx.fillText(line, cx, y);
  });
  return lines.length * lineH;
}

/** The neon script subtitle, glowing and tucked at a slight tilt. */
function drawScriptLine(ctx, text, cx, y, size) {
  if (!text) return;
  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(-0.03);
  ctx.font = `${size}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(255, 46, 136, 0.95)';
  ctx.shadowBlur = size * 0.45;
  ctx.fillStyle = '#fff5fa';
  ctx.fillText(text, 0, 0);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Small letterspaced capitals — kickers, taglines and credits, shrunk to fit. */
function drawSpacedCaps(ctx, text, cx, y, size, colour, maxW) {
  if (!text) return;
  const words = text.toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let fitted = size;
  const setFont = (s) => {
    ctx.font = `700 ${s}px 'Segoe UI', Arial, sans-serif`;
    try {
      ctx.letterSpacing = `${Math.round(s * 0.32)}px`;
    } catch { /* engines without letterSpacing draw the words plain */ }
  };
  setFont(fitted);
  // Letter-spacing widens a line past its measured width on some engines, so the
  // fit is checked against 92% of the room the caller offers.
  while (fitted > 6 && ctx.measureText(words).width > maxW * 0.92) {
    fitted -= 1;
    setFont(fitted);
  }
  ctx.fillStyle = colour;
  ctx.fillText(words, cx, y);
  try {
    ctx.letterSpacing = '0px';
  } catch { /* nothing to reset */ }
}

/** The designed title block that sits inside the panel grid. */
function drawBlockTitle(ctx, rect, view) {
  const { x, y, w, h } = rect;
  const ramp = view.ramp ?? INK_RAMPS.sunset;
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, `rgb(${ramp.stops[0][0]}, ${ramp.stops[0][1]}, ${ramp.stops[0][2]})`);
  grad.addColorStop(0.6, `rgb(${ramp.stops[1][0]}, ${ramp.stops[1][1]}, ${ramp.stops[1][2]})`);
  grad.addColorStop(1, `rgb(${ramp.stops[2][0]}, ${ramp.stops[2][1]}, ${ramp.stops[2][2]})`);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  // Halftone dots drift over the block, denser toward its foot.
  ctx.fillStyle = 'rgba(10, 4, 20, 0.16)';
  const cellDots = Math.max(6, w / 46);
  for (let dy = y + cellDots / 2; dy < y + h; dy += cellDots) {
    for (let dx = x + cellDots / 2; dx < x + w; dx += cellDots) {
      const depth = (dy - y) / h;
      ctx.beginPath();
      ctx.arc(dx, dy, cellDots * 0.16 * (0.4 + depth), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawSkyline(ctx, x, y + h, w, h * 0.24, view.rand, 'rgba(12, 5, 22, 0.85)');
  const cx = x + w / 2;
  const pad = w * 0.07;
  drawSpacedCaps(ctx, view.state.tagline, cx, y + h * 0.055, Math.min(h * 0.062, w * 0.052), '#ffd9a0', w - pad * 2);
  const fitted = fitTitleLines(ctx, view.state.caption.toUpperCase(), w - pad * 2, h * 0.44, h * 0.30);
  const titleH = drawTitleText(ctx, fitted.lines, fitted.size, cx, y + h * 0.15, view.ramp);
  drawScriptLine(ctx, view.state.subtitle, cx, y + h * 0.15 + titleH + h * 0.015, h * 0.105);
  drawHeatStars(ctx, cx, y + h * 0.80, h * 0.075, view.state.heat, 'center');
  ctx.strokeStyle = view.frameColour;
  ctx.lineWidth = view.gutter;
  ctx.strokeRect(x, y, w, h);
}

/** The title over a photograph: a scrim first, then left-set lettering. */
function drawOverlayTitle(ctx, rect, view) {
  const { x, y, w, h } = rect;
  const scrim = ctx.createLinearGradient(0, y - h * 0.25, 0, y + h);
  scrim.addColorStop(0, 'rgba(14, 5, 24, 0)');
  scrim.addColorStop(0.45, 'rgba(14, 5, 24, 0.55)');
  scrim.addColorStop(1, 'rgba(14, 5, 24, 0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(x - view.gutter, y - h * 0.25, w + view.gutter * 2, h * 1.25 + view.gutter);
  drawSpacedCaps(ctx, view.state.tagline, x + w / 2, y + h * 0.06, h * 0.075, '#ffd9a0', w * 0.96);
  const fitted = fitTitleLines(ctx, view.state.caption.toUpperCase(), w * 0.96, h * 0.52, h * 0.42);
  const titleH = drawTitleText(ctx, fitted.lines, fitted.size, x + w / 2, y + h * 0.17, view.ramp);
  drawScriptLine(ctx, view.state.subtitle, x + w / 2, y + h * 0.17 + titleH + h * 0.02, h * 0.13);
  drawHeatStars(ctx, x + w / 2, y + h * 0.90, h * 0.085, view.state.heat, 'center');
}

/** The magazine masthead: a deep band across the top, the title set in one line. */
function drawMastheadTitle(ctx, rect, view) {
  const { x, y, w, h } = rect;
  const ramp = view.ramp ?? INK_RAMPS.sunset;
  ctx.fillStyle = `rgb(${ramp.stops[0][0]}, ${ramp.stops[0][1]}, ${ramp.stops[0][2]})`;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = `rgb(${ramp.stops[2][0]}, ${ramp.stops[2][1]}, ${ramp.stops[2][2]})`;
  ctx.fillRect(x, y + h - Math.max(3, h * 0.045), w, Math.max(3, h * 0.045));
  drawSpacedCaps(ctx, view.state.tagline, x + w / 2, y + h * 0.09, h * 0.095, '#ffd9a0', w * 0.55);
  const fitted = fitTitleLines(ctx, view.state.caption.toUpperCase(), w * 0.94, h * 0.52, h * 0.56);
  drawTitleText(ctx, fitted.lines, fitted.size, x + w / 2, y + h * 0.23, view.ramp);
  drawHeatStars(ctx, x + w * 0.035, y + h * 0.845, h * 0.14, view.state.heat, 'left');
  drawScriptLine(ctx, view.state.subtitle, x + w * 0.68, y + h * 0.62, h * 0.24);
}

/** The starburst badge in the cover's top corner. */
function drawBadge(ctx, w, h, view) {
  const texts = {
    new: ['NEW', 'SUMMER 2026'],
    est: ['EST.', '2026'],
    collectors: ['COLLECTORS', 'EDITION'],
  }[view.state.badge];
  if (!texts) return;
  const r = Math.min(w, h) * 0.105;
  const cx = w - r * 1.12;
  const cy = r * 1.12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);
  ctx.beginPath();
  const spikes = 18;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.78;
    const a = (i * Math.PI) / spikes;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#ffe259');
  grad.addColorStop(1, '#ff7518');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = r * 0.045;
  ctx.strokeStyle = '#7a1f3d';
  ctx.stroke();
  ctx.fillStyle = '#571233';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${r * 0.42 * Math.min(1, 8 / texts[0].length)}px Anton, 'Arial Narrow', sans-serif`;
  ctx.fillText(texts[0], 0, -r * 0.16);
  ctx.font = `700 ${r * 0.21}px 'Segoe UI', Arial, sans-serif`;
  ctx.fillText(texts[1], 0, r * 0.28);
  ctx.restore();
}

/**
 * Renders the whole cover. `view` carries the resolved ramp, the grain tile and a
 * seeded random source; `photos` are { img, x, y } focus entries by slot.
 */
export function renderCover(canvas, layout, state, photos, view) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  view.state = state;
  view.ramp = resolveRamp(state, view.matchedRamp);
  view.lut = view.ramp ? buildRampLut(view.ramp.stops) : null;
  view.gutter = Math.max(3, Math.min(w, h) * 0.0075);
  view.dotCell = Math.max(4, Math.round(Math.min(w, h) / 150));
  view.frameColour = state.frame === 'ink' ? '#17102a' : '#f5ecd9';
  ctx.fillStyle = '#120c22';
  ctx.fillRect(0, 0, w, h);

  for (const panelDef of layout.panels) {
    const slot = state.panels[panelDef.id] ?? { photo: panelDef.photo, zoom: 1, ox: 0, oy: 0 };
    drawPhotoPanel(ctx, w, h, panelDef, photos[slot.photo] ?? null, slot, view);
  }
  if (layout.cards) {
    // Dim the backdrop so the thrown-down snapshots sit on top of it.
    ctx.fillStyle = 'rgba(10, 4, 20, 0.30)';
    ctx.fillRect(0, 0, w, h);
    layout.cards.forEach((card, i) => {
      const slot = state.panels[`card-${i}`];
      const photo = photos[slot ? slot.photo : card.photo] ?? null;
      drawSnapshotCard(ctx, w, h, card, photo, view);
    });
  }

  const t = layout.title;
  const rect = { x: t.x * w, y: t.y * h, w: t.w * w, h: t.h * h };
  if (t.kind === 'block') drawBlockTitle(ctx, rect, view);
  else if (t.kind === 'overlay') drawOverlayTitle(ctx, rect, view);
  else drawMastheadTitle(ctx, rect, view);

  drawBadge(ctx, w, h, view);

  // Paper grain and a vignette finish the sheet.
  if (view.grainTile) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(view.grainTile, 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(8, 3, 16, 0)');
  vig.addColorStop(1, 'rgba(8, 3, 16, 0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = view.frameColour;
  ctx.lineWidth = view.gutter * 1.6;
  ctx.strokeRect(0, 0, w, h);
}
