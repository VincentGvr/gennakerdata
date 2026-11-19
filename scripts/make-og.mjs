// Generates the default Open Graph image (public/og-default.png) from an SVG.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f1b4d"/><stop offset="1" stop-color="#1a4fd6"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#g)"/>
<text x="80" y="290" font-family="Segoe UI, Arial, sans-serif" font-size="110" font-weight="700" fill="#fff">Gennaker Data</text>
<text x="80" y="370" font-family="Segoe UI, Arial, sans-serif" font-size="40" fill="#dbe5ff">Azure · Microsoft Fabric · Power BI · PowerShell · SQL</text>
<text x="80" y="540" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#b9c9ff">Vincent Guyonvarch</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL('../public/og-default.png', import.meta.url)));
console.log('public/og-default.png written');
