import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
let html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
const styleSources = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(match => match[1]);
for (const src of styleSources) {
  let css = await fs.readFile(path.join(dist, src), 'utf8');
  for (const font of new Set([...css.matchAll(/assets\/fonts\/opendyslexic\/[a-zA-Z0-9-]+\.woff/g)].map(match => match[0]))) {
    const bytes = await fs.readFile(path.join(dist, font));
    css = css.replaceAll(font, 'data:font/woff;base64,' + bytes.toString('base64'));
  }
  html = html.replace('<link rel="stylesheet" href="' + src + '">', '<style>' + css + '</style>');
}
const scriptSources = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
for (const src of scriptSources) {
  let js = await fs.readFile(path.join(dist, src), 'utf8');
  if (src === 'sound-bank.js') {
    for (const asset of new Set([...js.matchAll(/assets\/audio\/[a-zA-Z0-9_\/-]+\.mp3/g)].map(m=>m[0]))) {
      const data = await fs.readFile(path.join(dist,asset));
      js = js.replaceAll(asset, 'data:audio/mpeg;base64,' + data.toString('base64'));
    }
  }
  if (src === 'welcome-audio-content.js') {
    for (const locale of ['en','es']) {
      const asset = 'assets/instructions/nvda-' + locale + '.mp3';
      js = js.replaceAll(asset, 'data:audio/mpeg;base64,' + (await fs.readFile(path.join(dist,asset))).toString('base64'));
    }
  }
  html = html.replace('<script src="' + src + '"></script>', () => '<script>' + js.replace(/<\/script/gi, '<\\/script') + '</script>');
}
const mediaSources = new Set([...html.matchAll(/(?:src|poster)="(assets\/alien\/[^"?#]+\.(?:mp4|jpg|png))"/g)].map(match => match[1]));
for (const src of mediaSources) {
  const bytes = await fs.readFile(path.join(dist, src));
  const mime = src.endsWith('.mp4') ? 'video/mp4' : src.endsWith('.png') ? 'image/png' : 'image/jpeg';
  html = html.replaceAll(src, 'data:' + mime + ';base64,' + bytes.toString('base64'));
}
const midi = await fs.readFile(path.join(dist, 'assets/music/The-Four-Seasons.mid'));
html = html.replaceAll('assets/music/The-Four-Seasons.mid', 'data:audio/midi;base64,' + midi.toString('base64'));
const recordSources = new Set([...html.matchAll(/assets\/records\/\d{4}\.png/g)].map(match => match[0]));
for (const src of recordSources) {
  const bytes = await fs.readFile(path.join(dist, src));
  html = html.replaceAll(src, 'data:image/png;base64,' + bytes.toString('base64'));
}
const brandingSources = new Set([...html.matchAll(/assets\/branding\/[a-zA-Z0-9-]+\.(?:svg|png|jpg)/g)].map(match => match[0]));
for (const src of brandingSources) {
  const bytes = await fs.readFile(path.join(dist, src));
  const mime = src.endsWith('.svg') ? 'image/svg+xml' : src.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
  html = html.replaceAll(src, 'data:' + mime + ';base64,' + bytes.toString('base64'));
}
for (const locale of ['en','es']) {
  const asset='assets/instructions/nvda-'+locale+'.mp3';
  html=html.replaceAll(asset,'data:audio/mpeg;base64,'+(await fs.readFile(path.join(dist,asset))).toString('base64'));
}
const out = path.join(root, 'PulsoTerra-sin-internet.html');
await fs.writeFile(out, html, 'utf8');
console.log('Versión sin conexión: ' + out);
