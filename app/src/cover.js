// cover.js — draws a finished Vice Ink cover onto a canvas.
//
// The pipeline: every photo panel is fitted into its (possibly slanted) polygon,
// inked by the print engine and stroked with the frame colour so the seams read
// as one printed sheet; a soft bloom lifts the highlights; then the furniture
// every printed cover carries — a palm-and-sunset tagline strip, a credits
// microline, a barcode and the studio bug — is laid along the foot, the title
// lockup is lettered over the panels (a giant gradient title with the script
// subtitle tucked under it and the pull-quote stars above), and a starburst
// seal is stamped over a panel junction. Paper grain and a vignette finish it.

import { DEFAULT_FX, INK_RAMPS, buildRampLut, inkPixels, seededRandom } from './ink.js';
import { polygonBox } from './layouts.js';

/** How much of a photo's own colour survives its ink, per grade. */
const HUE_KEEP = { spectrum: 0.1, sunset: 0.12, neonnight: 0.08, neon: 0.1, coast: 0.16, comic: 0.08, pop: 0.05, mono: 0, match: 0.12, clean: 0 };

/** The title-face gradients, top stop first, per grade (Palette Match uses its ramp). */
const TITLE_GRADIENTS = {
  spectrum: ['#fff3c4', '#ffc46b', '#ff7a3c', '#ff2e78'],
  sunset: ['#fff3c4', '#ffc46b', '#ff7a3c', '#ff2e78'],
  neonnight: ['#eafcff', '#8fe8ff', '#ff7ae0', '#ff2e88'],
  neon: ['#eafcff', '#8fe8ff', '#ff7ae0', '#ff2e88'],
  comic: ['#fff6d8', '#ffd23c', '#ff7a2e', '#e83e2e'],
  pop: ['#fff6d8', '#ffd23c', '#ff7a2e', '#e83e2e'],
  coast: ['#eafff2', '#a8ecc8', '#ffd76b', '#ff9a3c'],
  mono: ['#ffffff', '#e8e0cc', '#b8ab8e', '#77694f'],
  clean: ['#fff3c4', '#ffc46b', '#ff7a3c', '#ff2e78'],
};

/** Resolves the state's grade choice to a concrete ramp ({ stops, dot }). */
export function resolveRamp(state, matchedRamp) {
  if (state.grade === 'match' && matchedRamp) return matchedRamp;
  if (state.grade === 'clean') return null;
  return INK_RAMPS[state.grade] ?? INK_RAMPS.spectrum;
}

/** The four title-face colours for this cover, as CSS colours. */
function titleGradientStops(view) {
  const named = TITLE_GRADIENTS[view.state.grade];
  if (named) return named;
  const stops = (view.ramp ?? INK_RAMPS.spectrum).stops;
  const css = (s) => `rgb(${s[0]}, ${s[1]}, ${s[2]})`;
  return [
    css(stops[stops.length - 1]),
    css(stops[stops.length - 2]),
    css(stops[Math.max(0, stops.length - 3)]),
    css(stops[Math.max(0, stops.length - 4)]),
  ];
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
const bloomScratch = document.createElement('canvas');

/** Inks one fitted photo on the scratch canvas, honouring the finishing sliders. */
function inkScratch(sctx, width, height, view) {
  const data = sctx.getImageData(0, 0, width, height);
  const fx = view.fx;
  const dot = view.ramp ? view.ramp.dot * (fx.halftone ? 1 : 0) : 0;
  inkPixels(data, view.lut, dot, view.dotCell, HUE_KEEP[view.state.grade] ?? 0.1, fx, view.ramp?.posterize ?? 0);
  sctx.putImageData(data, 0, 0);
  if (!view.ramp) {
    const tint = sctx.createLinearGradient(0, 0, 0, height);
    tint.addColorStop(0, 'rgba(255, 150, 70, 0.10)');
    tint.addColorStop(1, 'rgba(190, 30, 110, 0.20)');
    sctx.globalCompositeOperation = 'soft-light';
    sctx.fillStyle = tint;
    sctx.fillRect(0, 0, width, height);
    sctx.globalCompositeOperation = 'source-over';
  }
}

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
  inkScratch(sctx, scratch.width, scratch.height, view);
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
    inkScratch(sctx, scratch.width, scratch.height, view);
    ctx.drawImage(scratch, -cw / 2 + frame, -ch / 2 + frame);
  }
  ctx.restore();
}

/**
 * Soft bloom: the sheet is copied, blurred and screened back over itself, so the
 * highlights of a sunset or a neon sign glow the way they do on a cinema poster.
 */
function applyBloom(ctx, w, h, amount) {
  bloomScratch.width = w;
  bloomScratch.height = h;
  const bctx = bloomScratch.getContext('2d');
  bctx.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = amount;
  ctx.filter = `blur(${Math.max(6, Math.round(Math.min(w, h) * 0.012))}px) saturate(1.35) brightness(1.12)`;
  ctx.drawImage(bloomScratch, 0, 0);
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
    const stops = ramp ? ramp.stops : INK_RAMPS.spectrum.stops;
    grad.addColorStop(0, `rgb(${stops[stops.length - 1][0]}, ${stops[stops.length - 1][1]}, ${stops[stops.length - 1][2]})`);
    grad.addColorStop(0.55, `rgb(${stops[stops.length - 2][0]}, ${stops[stops.length - 2][1]}, ${stops[stops.length - 2][2]})`);
    grad.addColorStop(1, `rgb(${stops[Math.max(0, stops.length - 3)][0]}, ${stops[Math.max(0, stops.length - 3)][1]}, ${stops[Math.max(0, stops.length - 3)][2]})`);
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
function drawSpacedCaps(ctx, text, x, y, size, colour, maxW, align = 'center') {
  if (!text) return;
  const words = text.toUpperCase();
  ctx.textAlign = align;
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
  ctx.fillText(words, x, y);
  try {
    ctx.letterSpacing = '0px';
  } catch { /* nothing to reset */ }
}

/** Fits a hero title: one wide line, or two stacked lines when the layout asks. */
function fitHeroLines(ctx, text, maxW, startSize, wantLines) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [], size: startSize };
  const fitsAt = (lines, size) => {
    ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
    return lines.every((line) => ctx.measureText(line).width <= maxW);
  };
  const fit = (lines) => {
    let s = startSize;
    while (s > 12 && !fitsAt(lines, s)) s -= 2;
    return { lines, size: s };
  };
  if (wantLines === 2 && words.length > 1) {
    let best = null;
    for (let cut = 1; cut < words.length; cut++) {
      const candidate = fit([words.slice(0, cut).join(' '), words.slice(cut).join(' ')]);
      if (!best || candidate.size > best.size) best = candidate;
    }
    return best;
  }
  return fit([text]);
}

/**
 * The hero lockup: the pull-quote row (heat stars and the quote) above a giant
 * gradient title that overlaps the panels, the script subtitle tucked under the
 * title's last line. This is the hierarchy of real key art — lettering first.
 */
function drawHeroTitle(ctx, spec, view) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = spec.cx * w;
  const topY = spec.top * h;
  const maxW = spec.maxW * w;
  const fitted = fitHeroLines(ctx, view.state.caption.toUpperCase(), maxW, spec.start * h, spec.lines ?? (h >= w ? 2 : 1));
  const { lines, size } = fitted;
  if (lines.length === 0) return;

  // The pull-quote row: the heat stars, then the quote in spaced capitals.
  const quoteY = topY - size * 0.52;
  ctx.save();
  ctx.shadowColor = 'rgba(10, 2, 16, 0.7)';
  ctx.shadowBlur = size * 0.06;
  drawHeatStars(ctx, w * 0.048, quoteY + size * 0.09, size * 0.21, view.state.heat, 'left');
  ctx.restore();
  if (view.state.quote) {
    ctx.save();
    ctx.shadowColor = 'rgba(10, 2, 16, 0.8)';
    ctx.shadowBlur = size * 0.05;
    drawSpacedCaps(ctx, `"${view.state.quote}"`, w * 0.048 + size * 1.32, quoteY, size * 0.155, '#fff3d6', w * 0.72, 'left');
    ctx.restore();
  }

  // The title itself: a whisper of forward lean, a hard shade, a dark outline
  // and a face that runs the whole title gradient from paper to neon.
  const lineH = size * 1.02;
  const grad = ctx.createLinearGradient(0, topY, 0, topY + lines.length * lineH);
  const colours = titleGradientStops(view);
  grad.addColorStop(0, colours[0]);
  grad.addColorStop(0.38, colours[1]);
  grad.addColorStop(0.72, colours[2]);
  grad.addColorStop(1, colours[3]);
  ctx.save();
  ctx.translate(cx, 0);
  ctx.transform(1, 0, -0.045, 1, 0, 0);
  ctx.translate(-cx, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  lines.forEach((line, i) => {
    const y = topY + i * lineH;
    ctx.fillStyle = 'rgba(18, 5, 28, 0.92)';
    ctx.fillText(line, cx + size * 0.05, y + size * 0.06);
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.15;
    ctx.strokeStyle = '#20082e';
    ctx.strokeText(line, cx, y);
    ctx.fillStyle = grad;
    ctx.fillText(line, cx, y);
  });
  ctx.restore();

  const titleH = lines.length * lineH;
  drawScriptLine(ctx, view.state.subtitle, cx + maxW * 0.07, topY + titleH - size * 0.30, size * 0.38);
}

/** The designed title block that sits inside the panel grid. */
function drawBlockTitle(ctx, rect, view) {
  const { x, y, w, h } = rect;
  const ramp = view.ramp ?? INK_RAMPS.spectrum;
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
  const ramp = view.ramp ?? INK_RAMPS.spectrum;
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

/** One palm silhouette: a leaning trunk and a crown of fronds, stroked in ink. */
function drawPalm(ctx, x, baseY, height, lean, colour) {
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, height * 0.055);
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.quadraticCurveTo(x + lean * 0.3, baseY - height * 0.62, x + lean, baseY - height);
  ctx.stroke();
  const tx = x + lean;
  const ty = baseY - height;
  ctx.lineWidth = Math.max(1.6, height * 0.038);
  const fronds = [[-0.95, -0.28], [-0.55, -0.52], [-0.12, -0.62], [0.3, -0.55], [0.68, -0.34], [0.95, -0.08]];
  for (const [fx, fy] of fronds) {
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + fx * height * 0.30, ty + fy * height * 0.30 - height * 0.06, tx + fx * height * 0.52, ty + fy * height * 0.52 + height * 0.10);
    ctx.stroke();
  }
  ctx.restore();
}

/** A small deterministic hash of a string, for catalogue numbers and barcodes. */
function textHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** The barcode at the foot of the credits line, its bars mixed from the caption. */
function drawBarcode(ctx, w, h, creditsH, view) {
  const bw = w * 0.082;
  const bh = creditsH * 0.82;
  const bx = w - bw - w * 0.012;
  const by = h - creditsH + (creditsH - bh) / 2;
  ctx.fillStyle = '#f7f2e6';
  ctx.fillRect(bx, by, bw, bh);
  const rand = seededRandom(textHash(`${view.state.caption}|${view.state.subtitle}`));
  ctx.fillStyle = '#14100c';
  let x = bx + bw * 0.06;
  while (x < bx + bw * 0.90) {
    const barW = (0.5 + rand() * 1.8) * (bw / 64);
    if (rand() > 0.35) ctx.fillRect(x, by + bh * 0.08, barW, bh * 0.84);
    x += barW + (0.5 + rand() * 1.4) * (bw / 64);
  }
}

/** The foot metrics every cover shares: the tagline strip and the credits line. */
function footMetrics(w, h, view) {
  if (view.state.furniture === false) return { stripH: 0, creditsH: 0, stripY: h };
  const creditsH = Math.max(20, h * 0.034);
  const stripH = h * 0.082;
  return { stripH, creditsH, stripY: h - creditsH - stripH };
}

/**
 * The furniture composer: a sunset strip with palm silhouettes and the tagline
 * across the foot, and beneath it a credits microline with the studio bug at
 * its left and a barcode at its right. Every exported cover carries it.
 */
function drawFurniture(ctx, w, h, view) {
  if (view.state.furniture === false) return;
  const { stripH, creditsH, stripY } = footMetrics(w, h, view);
  const ramp = view.ramp ?? INK_RAMPS.spectrum;
  const stops = ramp.stops;
  const css = (s) => `rgb(${s[0]}, ${s[1]}, ${s[2]})`;
  const grad = ctx.createLinearGradient(0, stripY, w, stripY);
  grad.addColorStop(0, css(stops[0]));
  grad.addColorStop(0.45, css(stops[Math.min(2, stops.length - 1)]));
  grad.addColorStop(0.78, css(stops[stops.length - 2]));
  grad.addColorStop(1, css(stops[Math.max(0, stops.length - 3)]));
  ctx.fillStyle = grad;
  ctx.fillRect(0, stripY, w, stripH);

  // The setting sun at the strip's heart, slit by the horizon lines.
  const sunR = stripH * 0.40;
  const sunGrad = ctx.createLinearGradient(0, stripY, 0, stripY + stripH);
  sunGrad.addColorStop(0, '#ffd76b');
  sunGrad.addColorStop(1, '#ff5e3a');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(w / 2, stripY + stripH * 0.56, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css(stops[0]);
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(w / 2 - sunR, stripY + stripH * (0.58 + i * 0.15), sunR * 2, Math.max(1.5, stripH * 0.045));
  }

  // Palms stand along the strip, taller at its edges.
  const palmColour = 'rgba(14, 5, 24, 0.88)';
  const palms = [[0.035, 1.0, 6], [0.105, 0.82, -5], [0.175, 0.94, 7], [0.825, 0.94, -7], [0.895, 0.82, 5], [0.965, 1.0, -6]];
  for (const [px, ph, lean] of palms) {
    drawPalm(ctx, px * w, stripY + stripH * 0.99, stripH * ph, (lean / 100) * w * 0.1, palmColour);
  }

  // The tagline rides the strip in spaced capitals.
  const tag = (view.state.tagline || 'Vice Ink Studio').replace(/\.\s+/g, ' · ');
  ctx.save();
  ctx.shadowColor = 'rgba(10, 2, 16, 0.65)';
  ctx.shadowBlur = 6;
  drawSpacedCaps(ctx, tag, w / 2, stripY + stripH * 0.30, stripH * 0.34, '#fff7ea', w * 0.94);
  ctx.restore();

  // The credits microline on its ink band: bug, credits, barcode.
  ctx.fillStyle = '#0c0616';
  ctx.fillRect(0, h - creditsH, w, creditsH);
  const bugS = creditsH * 0.8;
  const bugX = w * 0.012;
  const bugY = h - creditsH + (creditsH - bugS) / 2;
  const bugGrad = ctx.createLinearGradient(bugX, bugY, bugX + bugS, bugY + bugS);
  bugGrad.addColorStop(0, '#ff7518');
  bugGrad.addColorStop(1, '#ff2e88');
  ctx.fillStyle = bugGrad;
  ctx.beginPath();
  ctx.roundRect(bugX, bugY, bugS, bugS, bugS * 0.22);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `${bugS * 0.52}px Anton, 'Arial Narrow', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VI', bugX + bugS / 2, bugY + bugS * 0.54);
  const catalogue = 1000 + (textHash(`${view.state.caption}|${view.state.subtitle}`) % 9000);
  const credits = `${(view.state.caption || '').toUpperCase()} · A VICE INK STUDIO PRINT · STARRING YOU · SHOT ON YOUR OWN CAMERA · INK MIXED BY HAND · CAT. VI-${catalogue}`;
  drawSpacedCaps(ctx, credits, bugX + bugS + w * 0.012, h - creditsH + creditsH * 0.30, creditsH * 0.40, '#b9aed6', w * 0.78, 'left');
  drawBarcode(ctx, w, h, creditsH, view);
}

/**
 * The starburst seal: a spiked burst with a cream ring at its heart, three tiny
 * stars and the seal's two lines. Stamped over a panel junction, it is the
 * dressing that says this print is an original.
 */
function drawSeal(ctx, cx, cy, r, view) {
  const texts = {
    original: ['ORIGINAL', 'INK PRINT'],
    est: ['EST.', '2026'],
    new: ['NEW', 'SUMMER 2026'],
    collectors: ['COLLECTORS', 'EDITION'],
  }[view.state.badge];
  if (!texts) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);
  ctx.beginPath();
  const spikes = 22;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.80;
    const a = (i * Math.PI) / spikes;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const burst = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  if (view.state.badge === 'original') {
    burst.addColorStop(0, '#ff6e63');
    burst.addColorStop(1, '#c2185b');
  } else {
    burst.addColorStop(0, '#ffe259');
    burst.addColorStop(1, '#ff7518');
  }
  ctx.fillStyle = burst;
  ctx.fill();
  ctx.lineWidth = r * 0.03;
  ctx.strokeStyle = '#571233';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
  ctx.fillStyle = '#fdf6e0';
  ctx.fill();
  ctx.lineWidth = r * 0.025;
  ctx.stroke();
  // Three tiny stars ride the ring's crown.
  ctx.fillStyle = '#e8a020';
  for (let i = -1; i <= 1; i++) {
    traceStar(ctx, i * r * 0.22, -r * 0.40, r * 0.075);
    ctx.fill();
  }
  ctx.fillStyle = '#571233';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${r * 0.30 * Math.min(1, 8.5 / texts[0].length)}px Anton, 'Arial Narrow', sans-serif`;
  ctx.fillText(texts[0], 0, -r * 0.02);
  ctx.font = `700 ${r * 0.155}px 'Segoe UI', Arial, sans-serif`;
  ctx.fillText(texts[1], 0, r * 0.30);
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
  view.fx = state.fx ?? DEFAULT_FX;
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

  if (view.ramp?.bloom) applyBloom(ctx, w, h, view.ramp.bloom);

  drawFurniture(ctx, w, h, view);

  const t = layout.title;
  if (t.kind === 'hero') {
    drawHeroTitle(ctx, t, view);
  } else {
    const rect = { x: t.x * w, y: t.y * h, w: t.w * w, h: t.h * h };
    if (t.kind === 'block') drawBlockTitle(ctx, rect, view);
    else if (t.kind === 'overlay') drawOverlayTitle(ctx, rect, view);
    else drawMastheadTitle(ctx, rect, view);
  }

  // The seal: over the junction the layout names, above the strip on a
  // masthead, or in the top corner as before.
  const sealR = Math.min(w, h) * 0.105;
  const { stripY } = footMetrics(w, h, view);
  let sealPos;
  if (t.seal) sealPos = { x: t.seal.x * w, y: t.seal.y * h };
  else if (t.kind === 'masthead') sealPos = { x: w - sealR * 1.2, y: stripY - sealR * 1.08 };
  else sealPos = { x: w - sealR * 1.18, y: sealR * 1.18 };
  drawSeal(ctx, sealPos.x, sealPos.y, sealR, view);

  // Paper grain and a vignette finish the sheet, both at the sliders' settings.
  if (view.grainTile) {
    ctx.save();
    ctx.globalAlpha = 0.015 + view.fx.grain * 0.14;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(view.grainTile, 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(8, 3, 16, 0)');
  vig.addColorStop(1, `rgba(8, 3, 16, ${view.fx.vignette * 0.55})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = view.frameColour;
  ctx.lineWidth = view.gutter * 1.6;
  ctx.strokeRect(0, 0, w, h);
}
