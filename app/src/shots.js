// shots.js — fixed scenes for the entry's screenshots.
//
// A `?shot=` query dresses the studio in one canned arrangement so a screenshot
// shows the app at its best without a hand on the mouse:
//   ?shot=cover   the exported cover alone, edge to edge (the cover screenshot)
//   ?shot=editor  the full editor with photos loaded and a panel selected
// Words and dressing come from the query: caption, subtitle, tagline, layout,
// grade, size (a post-size id) or px (an exact WxH), badge, heat, frame, assign
// (a comma list of photo slots, one per panel in reading order) and panel (the
// selected panel in the editor scene). window.__shotReady is set once painted.

/** Applies one scene described by `query` through the editor's own API. */
export async function runShot(shot, query, api) {
  const { state } = api;
  if (query.get('caption')) state.caption = query.get('caption');
  if (query.get('subtitle') !== null) state.subtitle = query.get('subtitle');
  if (query.get('tagline')) state.tagline = query.get('tagline');
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('badge')) state.badge = query.get('badge');
  if (query.get('frame')) state.frame = query.get('frame');
  if (query.get('heat') !== null) state.heat = Number(query.get('heat'));

  const px = query.get('px');
  if (px) {
    const [w, h] = px.split('x').map(Number);
    api.setExactSize(w, h);
  } else if (query.get('size')) {
    api.setSize(query.get('size'));
  }

  // Build the layout once before assigning photos: the panel list only exists
  // after a first render, and assignments are written against it.
  api.redraw();
  if (query.get('assign')) {
    const slots = query.get('assign').split(',').map(Number);
    api.panelEntries().forEach((entry, i) => {
      if (slots[i] !== undefined && api.photos[slots[i]]) {
        api.state.panels[entry.id] = { photo: slots[i], zoom: 1, ox: 0, oy: 0 };
      }
    });
  }
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'editor' && query.get('panel')) api.selectPanel(query.get('panel'));
  api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
