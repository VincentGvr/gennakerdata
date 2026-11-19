// Checks internal links, images and assets of the built site (dist/).
// Usage: node scripts/check-links.mjs [distDir]   (BASE_PATH env var must match the build; default /gennakerdata)
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const dist = path.resolve(process.argv[2] ?? 'dist');
const rawBase = process.env.BASE_PATH ?? '/gennakerdata';
const base = rawBase === '/' || rawBase === '' ? '' : '/' + rawBase.replace(/^\/+|\/+$/g, '');

function walk(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = path.join(dir, e.name);
		return e.isDirectory() ? walk(p) : [p];
	});
}

function resolves(urlPath) {
	let p = decodeURIComponent(urlPath);
	if (base) {
		if (p !== base && !p.startsWith(base + '/')) return false;
		p = p.slice(base.length) || '/';
	}
	const target = path.join(dist, p);
	if (!target.startsWith(dist)) return false;
	if (fs.existsSync(target) && fs.statSync(target).isFile()) return true;
	return fs.existsSync(path.join(target, 'index.html'));
}

const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
const problems = [];
let checked = 0;

for (const file of htmlFiles) {
	const rel = path.relative(dist, file);
	const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
	const refs = [];
	$('a[href], link[href], img[src], script[src], source[src], meta[property="og:image"]').each((_, el) => {
		const attr = el.attribs.href ?? el.attribs.src ?? el.attribs.content;
		if (attr) refs.push({ tag: el.tagName, value: attr });
	});
	$('img[srcset], source[srcset]').each((_, el) => {
		for (const part of el.attribs.srcset.split(',')) refs.push({ tag: el.tagName, value: part.trim().split(/\s+/)[0] });
	});
	for (const { tag, value } of refs) {
		if (/^(mailto:|tel:|data:|javascript:|#)/.test(value)) continue;
		if (rel === '404.html' && tag === 'link') continue; // canonical of the 404 page is not a real page
		let url;
		try {
			url = new URL(value, 'https://local.invalid' + (base || '') + '/' + rel.replace(/index\.html$/, ''));
		} catch {
			problems.push(`${rel}: invalid URL <${tag}> ${value}`);
			continue;
		}
		if (url.origin !== 'https://local.invalid') {
			// absolute URL (og:image, canonical...) pointing to the site itself is checked by path
			if (!/(vincentgvr\.github\.io|gennakerdata\.com)$/.test(url.hostname)) continue;
		}
		checked++;
		if (!resolves(url.pathname)) problems.push(`${rel}: broken <${tag}> ${value}`);
		if (url.hash && url.origin === 'https://local.invalid' && tag === 'a') {
			const t = path.join(dist, url.pathname.slice(base.length), url.pathname.endsWith('/') ? 'index.html' : '');
			if (fs.existsSync(t) && fs.statSync(t).isFile()) {
				const id = decodeURIComponent(url.hash.slice(1));
				const $t = cheerio.load(fs.readFileSync(t, 'utf8'));
				if (id && $t(`[id="${id}"], a[name="${id}"]`).length === 0) problems.push(`${rel}: missing anchor ${value}`);
			}
		}
	}
}

console.log(`Checked ${checked} internal references in ${htmlFiles.length} HTML files.`);
if (problems.length) {
	console.error(`\n${problems.length} problem(s):`);
	for (const p of [...new Set(problems)]) console.error(' - ' + p);
	process.exit(1);
}
console.log('No broken internal links or images.');
