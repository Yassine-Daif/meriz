// Génère les assets du logo Meriz (variante A5P « Accolées · pastille ») dans exports/.
// Usage : dans ce dossier, `npm install` puis `npm run generer`.
import { Resvg } from '@resvg/resvg-js';
import opentype from 'opentype.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..');
const FONT = path.join(HERE, 'node_modules/@fontsource/outfit/files/outfit-latin-600-normal.woff');

const COLORS = {
  light: { p: '#4338CA', w: '#FFFFFF', ink: '#1E1B4B' },
  dark:  { p: '#6366F1', w: '#FFFFFF', ink: '#FFFFFF' },
};

// Dessin A5P du labo, transformation translate(9.6 9.6) scale(.7) appliquée aux coordonnées :
// tige en V (trait 6 × .7), deux cerises r 15 × .7, filet de séparation 4.8 × .7.
const glyph = ({ p, w }) =>
  `<path d="M24.3 32 32 15.2 39.7 32" fill="none" stroke="${w}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>\n  ` +
  `<circle cx="24.3" cy="40.4" r="10.5" fill="${w}"/>\n  ` +
  `<circle cx="39.7" cy="40.4" r="10.5" fill="${w}" stroke="${p}" stroke-width="3.36"/>`;

const svgDoc = (inner, w = 64, h = 64, title = 'Meriz') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n` +
  `  <title>${title}</title>\n  ${inner}\n</svg>\n`;

// Pastille : carré arrondi indigo + dessin blanc
const pastille = c => `<rect width="64" height="64" rx="15" fill="${c.p}"/>\n  ${glyph(c)}`;
// Plein cadre (apple-touch, maskable) : le système applique son propre masque.
// scale < 1 réduit le dessin autour du centre pour la zone de sécurité.
const fullBleed = (c, scale = 1) => {
  const g = scale === 1 ? glyph(c)
    : `<g transform="translate(${32 * (1 - scale)} ${32 * (1 - scale)}) scale(${scale})">${glyph(c)}</g>`;
  return `<rect width="64" height="64" fill="${c.p}"/>\n  ${g}`;
};

function write(rel, data) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

// ICO contenant des PNG (format accepté par tous les navigateurs actuels)
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(i => i.data)]);
}

// --- SVG maîtres
const master = { light: svgDoc(pastille(COLORS.light)), dark: svgDoc(pastille(COLORS.dark)) };
write('svg/meriz-logo.svg', master.light);
write('svg/meriz-logo-dark.svg', master.dark);

// --- Lockup : icône + « Meriz » vectorisé (Outfit SemiBold)
const font = opentype.parse(fs.readFileSync(FONT).buffer.slice(0));
const ICON = 64, GAP = 16;               // espace icône-mot = 1/4 de l'icône
const capRatio = font.tables.os2.sCapHeight / font.unitsPerEm;
const fontSize = 32 / capRatio;          // hauteur des capitales = moitié de l'icône
const baseline = 32 + 16;                // capitales centrées verticalement sur l'icône
// Placement glyphe par glyphe avec crénage (le moteur de mise en forme d'opentype.js
// ne gère pas une des tables d'Outfit ; « Meriz » n'a besoin d'aucune ligature).
function wordPath(text, x, y) {
  const scale = fontSize / font.unitsPerEm;
  const glyphs = [...text].map(ch => font.charToGlyph(ch));
  const full = new opentype.Path();
  glyphs.forEach((g, i) => {
    full.extend(g.getPath(x, y, fontSize));
    if (i < glyphs.length - 1) x += (g.advanceWidth + font.getKerningValue(g, glyphs[i + 1])) * scale;
  });
  return full;
}
const bb = wordPath('Meriz', 0, 0).getBoundingBox();
const tx = ICON + GAP - bb.x1;           // bord gauche réel du M posé contre l'espace
const textPath = wordPath('Meriz', tx, baseline).toPathData(2);
const lockupW = Math.ceil(ICON + GAP + (bb.x2 - bb.x1));
const lockup = c => svgDoc(`${pastille(c)}\n  <path d="${textPath}" fill="${c.ink}"/>`, lockupW, 64, 'Meriz');
write('svg/meriz-lockup.svg', lockup(COLORS.light));
write('svg/meriz-lockup-dark.svg', lockup(COLORS.dark));

// --- PNG de l'icône, fond transparent
for (const s of [1024, 512, 256, 128, 64, 32, 16]) write(`png/meriz-icon-${s}.png`, png(master.light, s));

// --- Web
write('web/favicon.svg', master.light);
write('web/favicon.ico', ico([16, 32, 48].map(size => ({ size, data: png(master.light, size) }))));
write('web/apple-touch-icon.png', png(svgDoc(fullBleed(COLORS.light)), 180));
write('web/icon-192.png', png(master.light, 192));
write('web/icon-512.png', png(master.light, 512));
const maskable = svgDoc(fullBleed(COLORS.light, 0.85));
write('web/icon-maskable-192.png', png(maskable, 192));
write('web/icon-maskable-512.png', png(maskable, 512));

// --- Source Tauri
write('tauri/app-icon.png', png(master.light, 1024));

console.log('ok', { fontSize: fontSize.toFixed(2), lockupW });
