// take-screenshots.mjs — captures the entry's screenshots from the app itself.
//
//   node take-screenshots.mjs [chrome-binary]
//
// It serves app/ with serve.ts, then drives headless Chrome through every scene
// in shots.json: each scene is one of the app's own ?shot= arrangements, so a
// cover screenshot is the cover the app draws, at exactly the size the file
// holds, and the editor screenshot is the studio with a photo loaded. Captures
// land in screenshots/ as PNG; the caller converts them to the shipped JPEGs.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const chrome = process.argv[2]
  ?? `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const port = 8123;
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));

mkdirSync(join(root, 'screenshots'), { recursive: true });

const server = spawn('node', [join(root, 'serve.ts'), '--port', String(port)], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await wait(900);
  for (const shot of shots) {
    const url = `http://localhost:${port}/index.html${shot.query}`;
    const out = join(root, 'screenshots', shot.name.replace(/\.jpg$/, '.png'));
    execFileSync(chrome, [
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--virtual-time-budget=30000',
      `--window-size=${shot.w},${shot.h}`,
      `--screenshot=${out}`,
      url,
    ], { stdio: 'inherit' });
    console.log(`captured ${shot.name} at ${shot.w}x${shot.h}`);
  }
} finally {
  server.kill();
}
