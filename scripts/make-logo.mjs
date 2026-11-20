// Builds the logo, header mark, favicons and default OG image from scripts/assets/logo-source.png
// (black line drawing on white). Run: node scripts/make-logo.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const SRC = root('scripts/assets/logo-source.png');
const ACCENT = { r: 0x1a, g: 0x4f, b: 0xd6 };

// White background -> transparent; keeps anti-aliasing as alpha. Output is a solid-colour mask.
async function toMask(input, color = { r: 0, g: 0, b: 0 }) {
	const { data, info } = await sharp(input).flatten({ background: '#fff' }).greyscale().raw().toBuffer({ resolveWithObject: true });
	const ch = info.channels;
	const out = Buffer.alloc(info.width * info.height * 4);
	for (let i = 0; i < info.width * info.height; i++) {
		const a = Math.min(255, Math.max(0, Math.round((255 - data[i * ch]) * 1.15 - 8)));
		out[i * 4] = color.r;
		out[i * 4 + 1] = color.g;
		out[i * 4 + 2] = color.b;
		out[i * 4 + 3] = a;
	}
	return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// Thicken the strokes of a mask so it stays readable when scaled down.
async function thicken(maskPng, size, blur, threshold) {
	const { data, info } = await sharp(maskPng).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).extractChannel(3).blur(blur).raw().toBuffer({ resolveWithObject: true });
	const out = Buffer.alloc(info.width * info.height);
	for (let i = 0; i < out.length; i++) out[i] = Math.min(255, Math.max(0, (data[i * info.channels] - threshold) * 6));
	return out;
}

// ---- full logo (transparent, black)
const full = await toMask(SRC);
const trimmed = await sharp(full).trim({ threshold: 5 }).toBuffer();
mkdirSync(root('src/assets'), { recursive: true });
await sharp(trimmed).resize({ width: 900 }).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(root('src/assets/logo.png'));

// ---- compact mark: the stack of platters, strokes thickened
const crop = { left: 520, top: 425, width: 415, height: 390 };
const cropped = await sharp(SRC).extract(crop).toBuffer();
const side = Math.max(crop.width, crop.height) + 40;
const squared = await sharp(cropped).extend({ top: Math.floor((side - crop.height) / 2), bottom: Math.ceil((side - crop.height) / 2), left: Math.floor((side - crop.width) / 2), right: Math.ceil((side - crop.width) / 2), background: '#fff' }).toBuffer();
const maskSq = await toMask(squared);
const alpha = await thicken(maskSq, 1024, 6, 70);
const markWith = async (color, size) => {
	const rgba = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: color } }).joinChannel(alpha, { raw: { width: 1024, height: 1024, channels: 1 } }).png().toBuffer();
	return sharp(rgba).resize(size, size).png().toBuffer();
};

// header mark (black, transparent; inverted by CSS in dark mode)
await sharp(await markWith({ r: 0, g: 0, b: 0 }, 256)).png({ palette: true }).toFile(root('src/assets/logo-mark.png'));

// ---- favicons: white mark on a blue rounded tile
async function tile(size) {
	const radius = Math.round(size * 0.22);
	const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="rgb(${ACCENT.r},${ACCENT.g},${ACCENT.b})"/></svg>`);
	const inner = Math.round(size * 0.84);
	const mark = await markWith({ r: 255, g: 255, b: 255 }, inner);
	return sharp(bg).composite([{ input: mark, gravity: 'centre' }]).png().toBuffer();
}
const sizes = { 16: 16, 32: 32, 48: 48, 180: 180, 192: 192, 512: 512 };
const png = {};
for (const s of Object.values(sizes)) png[s] = await tile(s);

writeFileSync(root('public/favicon-32.png'), png[32]);
writeFileSync(root('public/apple-touch-icon.png'), png[180]);
writeFileSync(root('public/icon-192.png'), png[192]);
writeFileSync(root('public/icon-512.png'), png[512]);

// ICO with embedded PNGs (16, 32, 48)
const ico = [16, 32, 48];
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(ico.length, 4);
let offset = 6 + 16 * ico.length;
const entries = [];
for (const s of ico) {
	const e = Buffer.alloc(16);
	e[0] = s;
	e[1] = s;
	e.writeUInt16LE(1, 4);
	e.writeUInt16LE(32, 6);
	e.writeUInt32LE(png[s].length, 8);
	e.writeUInt32LE(offset, 12);
	offset += png[s].length;
	entries.push(e);
}
writeFileSync(root('public/favicon.ico'), Buffer.concat([header, ...entries, ...ico.map((s) => png[s])]));

writeFileSync(
	root('public/site.webmanifest'),
	`${JSON.stringify({ name: 'Gennaker Data', short_name: 'Gennaker', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }], theme_color: '#1a4fd6', background_color: '#ffffff', display: 'browser' }, null, '\t')}\n`,
);

// ---- default OG image: logo on white card with title
const logoForOg = await sharp(root('src/assets/logo.png')).resize({ height: 520 }).png().toBuffer();
const logoMeta = await sharp(logoForOg).metadata();
const og = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#fff"/><rect x="0" y="0" width="14" height="630" fill="rgb(${ACCENT.r},${ACCENT.g},${ACCENT.b})"/>
<text x="70" y="270" font-family="Segoe UI, Arial, sans-serif" font-size="92" font-weight="700" fill="#1b2233">Gennaker</text>
<text x="70" y="370" font-family="Segoe UI, Arial, sans-serif" font-size="92" font-weight="700" fill="#1b2233">Data</text>
<text x="70" y="450" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#4a5470">Azure · Microsoft Fabric · Power BI</text>
<text x="70" y="494" font-family="Segoe UI, Arial, sans-serif" font-size="30" fill="#4a5470">PowerShell · SQL</text>
<text x="70" y="570" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="rgb(${ACCENT.r},${ACCENT.g},${ACCENT.b})">Vincent Guyonvarch</text></svg>`);
await sharp(og).composite([{ input: logoForOg, left: 1200 - logoMeta.width - 50, top: Math.round((630 - logoMeta.height) / 2) }]).png({ compressionLevel: 9 }).toFile(root('public/og-default.png'));

console.log('logo, favicons and OG image written');
