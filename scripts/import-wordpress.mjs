/**
 * Converts a WordPress (WXR) export into Astro content collections.
 *
 *   node scripts/import-wordpress.mjs <export.xml> [--skip-download]
 *
 * - published posts  -> src/content/blog/<slug>.md
 * - published pages  -> src/content/pages/<slug>.md (the home page is rebuilt in Astro, not imported)
 * - images           -> src/assets/blog/<wp uploads path> (downloaded, links rewritten)
 * The script is idempotent: already downloaded images are reused.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import turndownGfm from 'turndown-plugin-gfm';
import { parseExport } from './parse-export.mjs';

const { gfm } = turndownGfm;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = join(ROOT, 'src/content/blog');
const PAGES_DIR = join(ROOT, 'src/content/pages');
const ASSETS_DIR = join(ROOT, 'src/assets/blog');
const MANIFEST = join(ROOT, 'scripts/image-manifest.json');
const SITE_HOSTS = new Set(['gennakerdata.com', 'www.gennakerdata.com', 'gennakerdata.wordpress.com']);

const args = process.argv.slice(2);
const exportFile = args.find((a) => !a.startsWith('--'));
const skipDownload = args.includes('--skip-download');
if (!exportFile) {
	console.error('Usage: node scripts/import-wordpress.mjs <export.xml> [--skip-download]');
	process.exit(1);
}

// Posts that exist in two languages, so each version can link to the other.
const TRANSLATIONS = {
	'mcp-fabric-rti-fr': 'mcp-fabric-rti-en',
	'mcp-fabric-rti-en': 'mcp-fabric-rti-fr',
	'capacity-metrics-app-analysis': 'capacity-metrics-app-analysis-english-version',
	'capacity-metrics-app-analysis-english-version': 'capacity-metrics-app-analysis',
	'fabric-data-agent-couts': 'microsoft-fabric-data-agent-whats-impacting-prompt-costs',
	'microsoft-fabric-data-agent-whats-impacting-prompt-costs': 'fabric-data-agent-couts',
};
const ENGLISH = new Set(['mcp-fabric-rti-en', 'capacity-metrics-app-analysis-english-version', 'microsoft-fabric-data-agent-whats-impacting-prompt-costs']);
// An article that lives as a WordPress page (/gennaker-data/<slug>/) and also as a dated post: the page is canonical.
const PAGE_ARTICLE = 'optimiser-les-couts-des-solutions-data-par-la-mise-en-pause-et-ou-a-lechelle-des-ressources-dans-azure';
const DUPLICATE_POST = 'optimiser-les-solutions-data-par-la-mise-en-pause-et-ou-a-lechelle-des-ressources-dans-azure';

const report = { missingImages: [], unresolvedLinks: [], emails: [], skipped: [], unmappedFromHome: [] };

// ---------------------------------------------------------------- images
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const inflight = new Map();
const EXT_BY_TYPE = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };

async function fetchBuffer(url) {
	let lastError;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (gennakerdata-migration)' }, signal: AbortSignal.timeout(45000) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return { buffer: Buffer.from(await res.arrayBuffer()), type: (res.headers.get('content-type') ?? '').split(';')[0] };
		} catch (e) {
			lastError = e;
		}
	}
	throw lastError;
}

function save(rel, buffer) {
	const target = join(ASSETS_DIR, rel);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, buffer);
}

/** Returns the path of the image relative to src/assets/blog, or null when it cannot be retrieved. */
function localizeImage(rawSrc) {
	let url;
	try {
		url = new URL(rawSrc);
	} catch {
		return Promise.resolve(null);
	}
	url.search = '';
	url.hash = '';
	const key = url.toString();
	if (!inflight.has(key)) inflight.set(key, doLocalize(url, key));
	return inflight.get(key);
}

async function doLocalize(url, key) {
	const uploads = url.pathname.match(/\/wp-content\/uploads\/(.+)$/);
	if (uploads && (SITE_HOSTS.has(url.hostname) || url.hostname.endsWith('.files.wordpress.com') || url.hostname.endsWith('.wp.com'))) {
		const rel = decodeURIComponent(uploads[1]);
		if (existsSync(join(ASSETS_DIR, rel))) return rel;
		if (skipDownload) return null;
		for (const host of ['gennakerdata.wordpress.com', 'gennakerdata.com']) {
			try {
				const { buffer, type } = await fetchBuffer(`https://${host}/wp-content/uploads/${uploads[1]}`);
				if (!type.startsWith('image/')) throw new Error(`type ${type}`);
				save(rel, buffer);
				return rel;
			} catch {
				/* try next host */
			}
		}
		report.missingImages.push(key);
		return null;
	}
	// external image (LinkedIn hotlinks); reuse the manifest to avoid re-fetching expired URLs
	if (key in manifest) return manifest[key];
	if (skipDownload) return null;
	try {
		const { buffer, type } = await fetchBuffer(url.toString());
		if (!type.startsWith('image/')) throw new Error(`type ${type}`);
		const rel = `external/${createHash('sha1').update(key).digest('hex').slice(0, 12)}${EXT_BY_TYPE[type] ?? '.jpg'}`;
		save(rel, buffer);
		manifest[key] = rel;
		return rel;
	} catch {
		manifest[key] = null;
		report.missingImages.push(key);
		return null;
	}
}

// ---------------------------------------------------------------- helpers
const yaml = (v) => JSON.stringify(v);
const clean = (s) => s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const toIso = (gmt) => (gmt && !gmt.startsWith('0000') ? `${gmt.replace(' ', 'T')}.000Z` : undefined);
const normPath = (p) => {
	let out = decodeURIComponent(p).toLowerCase();
	if (!out.startsWith('/')) out = `/${out}`;
	return out.endsWith('/') ? out : `${out}/`;
};

function guessLang(code) {
	const t = code.trim();
	if (/^[{[]/.test(t) && /"\s*:/.test(t)) return 'json';
	if (/\b(SELECT|INSERT\s+INTO|CREATE\s+(OR\s+ALTER\s+)?(TABLE|VIEW|PROCEDURE|EXTERNAL)|ALTER\s+TABLE|MERGE\s+\w|DECLARE\s+@|UPDATE\s+\S+\s+SET)\b/i.test(t)) return 'sql';
	if (/(^|\n)\s*\$\w+\s*=|\b(Get|Set|Invoke|New|Remove|Connect|Install)-[A-Z]\w+|\bparam\s*\(/.test(t)) return 'powershell';
	if (/(^|\n)\s*(import|from)\s+[\w.]+|\bdef\s+\w+\(|\bprint\(/.test(t)) return 'python';
	return 'text';
}

function pickLang(declared, code) {
	const known = new Set(['sql', 'powershell', 'python', 'json', 'bash', 'yaml', 'csharp', 'javascript', 'typescript', 'xml', 'html', 'css']);
	if (declared && known.has(declared)) return declared;
	const guessed = guessLang(code);
	if (declared === 'jscript' && guessed === 'text') return 'javascript';
	return guessed;
}

function detectLang(slug, text) {
	if (ENGLISH.has(slug)) return 'en';
	const words = text.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿ']+/g) ?? [];
	const en = words.filter((w) => ['the', 'and', 'with', 'of', 'is', 'that', 'this', 'for'].includes(w)).length;
	const fr = words.filter((w) => ['le', 'la', 'les', 'des', 'et', 'est', 'pour', 'dans', 'une'].includes(w)).length;
	return en > fr ? 'en' : 'fr';
}

// ---------------------------------------------------------------- parse export
const { items } = parseExport(exportFile);
const attachments = new Map(items.filter((i) => i.type === 'attachment').map((a) => [a.id, a]));
const published = items.filter((i) => i.status === 'publish');
const posts = published.filter((i) => i.type === 'post');
const pages = published.filter((i) => i.type === 'page');
for (const d of items.filter((i) => (i.type === 'post' || i.type === 'page') && i.status !== 'publish')) {
	report.skipped.push(`${d.type} #${d.id} (${d.status}) "${d.title}" ${d.date}`);
}

const homePage = pages.find((p) => p.link.replace(/\/$/, '') === 'https://gennakerdata.com');

// URL registry used to rewrite internal links
const byPath = new Map();
const byId = new Map();
const entries = [];
// The CV images contain a clear-text e-mail address and phone number: not republished (see README).
const EXCLUDED_PAGES = new Set(['cv-2']);
for (const it of [...posts, ...pages]) {
	if (it === homePage) continue;
	if (EXCLUDED_PAGES.has(it.slug)) {
		report.skipped.push(`page #${it.id} "${it.title}" (${it.link}) intentionally excluded (personal data)`);
		continue;
	}
	const permalink = normPath(new URL(it.link).pathname);
	const entry = { it, permalink, kind: it.type };
	entries.push(entry);
	byPath.set(permalink, permalink);
	byPath.set(normPath(`/${it.slug}`), permalink);
	byId.set(it.id, permalink);
}

function rewriteHref(href) {
	let url;
	try {
		url = new URL(href, 'https://gennakerdata.com');
	} catch {
		return href;
	}
	if (!SITE_HOSTS.has(url.hostname)) return href;
	const id = url.searchParams.get('p') ?? url.searchParams.get('page_id');
	if (id && byId.has(Number(id))) return byId.get(Number(id)) + url.hash;
	const p = normPath(url.pathname);
	if (p === '/') return `/${url.hash}`;
	if (byPath.has(p)) return byPath.get(p) + url.hash;
	if (/^\/wp-content\/uploads\//.test(p)) return href;
	report.unresolvedLinks.push(href);
	return href;
}

// ---------------------------------------------------------------- home page mapping (sections + card images)
const homeCards = new Map();
if (homePage) {
	const $h = cheerio.load(homePage.content.replace(/<!--[\s\S]*?-->/g, ''), null, false);
	let section = null;
	let order = 0;
	$h('h1, div.wp-block-columns').each((_, el) => {
		const node = $h(el);
		if (el.tagName === 'h1') {
			section = clean(node.text());
			return;
		}
		const link = node.find('a').filter((_, a) => /Lire/.test($h(a).text())).first();
		if (!section || !link.length) return;
		const target = rewriteHref(link.attr('href'));
		homeCards.set(target, { section, order: order++, image: node.find('img').first().attr('src') });
	});
}

// ---------------------------------------------------------------- convert
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*', hr: '---' });
turndown.use(gfm);
turndown.addRule('fencedPre', {
	filter: (node) => node.nodeName === 'PRE',
	replacement: (_content, node) => {
		const code = node.textContent.replace(/\r\n/g, '\n').replace(/^\n+|\s+$/g, '');
		const lang = pickLang(node.getAttribute('data-lang'), code);
		const fence = code.includes('```') ? '````' : '```';
		return `\n\n${fence}${lang}\n${code}\n${fence}\n\n`;
	},
});
turndown.addRule('figcaption', {
	filter: 'figcaption',
	replacement: (content) => (content.trim() ? `\n\n*${content.trim()}*\n\n` : ''),
});
turndown.addRule('image', {
	filter: 'img',
	replacement: (_c, node) => {
		const src = node.getAttribute('src');
		if (!src) return '';
		const alt = (node.getAttribute('alt') ?? '').replace(/[\[\]]/g, '');
		return `![${alt}](${src.replace(/ /g, '%20')})`;
	},
});

const BLOG_REL = relative(BLOG_DIR, ASSETS_DIR).replace(/\\/g, '/');
const PAGES_REL = relative(PAGES_DIR, ASSETS_DIR).replace(/\\/g, '/');

async function convert(entry) {
	const { it } = entry;
	const rel = entry.kind === 'post' ? BLOG_REL : PAGES_REL;
	let html = it.content.replace(/<!--\s*wp:syntaxhighlighter\/code\s*(\{.*?\})?\s*-->\s*<pre/g, (_m, json) => {
		let lang = '';
		try {
			lang = JSON.parse(json ?? '{}').language ?? '';
		} catch {
			/* ignore */
		}
		return `<pre data-lang="${lang}"`;
	});
	html = html.replace(/<!--[\s\S]*?-->/g, '');
	const $ = cheerio.load(html, null, false);

	$('.wp-block-spacer, script, style').remove();
	// about/contact block embedded at the end of some articles (contains an e-mail address); rebuilt on the home page
	$('.wp-block-columns').filter((_, c) => /Contactez-moi/.test($(c).text())).closest('.wp-block-group').remove();
	$('.wp-block-columns').filter((_, c) => /Contactez-moi/.test($(c).text())).remove();
	if (it.slug === 'cv-2') $('.wp-block-group').remove();

	// headings: make the shallowest level an h2 (the page title is the h1)
	const levels = $('h1,h2,h3,h4,h5,h6').map((_, h) => Number(h.tagName[1])).get();
	const shift = levels.length ? Math.min(...levels) - 2 : 0;
	if (shift !== 0) {
		$('h1,h2,h3,h4,h5,h6').each((_, h) => {
			h.tagName = `h${Math.min(6, Math.max(2, Number(h.tagName[1]) - shift))}`;
		});
	}

	// tables without a header row: promote the first row
	$('table').each((_, table) => {
		const first = $(table).find('tr').first();
		if (first.length && !first.find('th').length) first.children('td').each((_, td) => { td.tagName = 'th'; });
	});

	// images
	const images = [];
	let missingImages = 0;
	const imgNodes = $('img').toArray();
	await Promise.all(
		imgNodes.map(async (img) => {
			const node = $(img);
			const local = await localizeImage(node.attr('src') ?? '');
			if (!local) {
				missingImages++;
				const wrapper = node.closest('figure');
				(wrapper.length ? wrapper : node).remove();
				return;
			}
			node.attr('src', `${rel}/${local}`);
			images.push(`${rel}/${local}`);
			const link = node.parent('a');
			if (link.length && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(link.attr('href') ?? '') && link.children().length === 1) link.replaceWith(node);
		}),
	);

	// links
	$('a[href]').each((_, a) => {
		const node = $(a);
		const href = node.attr('href');
		if (/^mailto:/i.test(href)) {
			node.replaceWith(node.text());
			return;
		}
		node.attr('href', rewriteHref(href));
	});

	// description
	let description = clean(it.excerpt.replace(/<[^>]+>/g, ' '));
	if (!description) {
		const paragraphs = $('p').map((_, p) => clean($(p).text())).get().filter(Boolean);
		description = paragraphs.find((p) => p.length >= 60) ?? paragraphs[0] ?? it.title;
	}
	if (description.length > 180) description = `${description.slice(0, 177).replace(/\s+\S*$/, '')}…`;

	let md = turndown.turndown($.html()).replace(/\u00a0/g, ' ').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
	const emails = md.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g);
	if (emails) report.emails.push(`${it.slug}: ${emails.join(', ')}`);
	return { md: `${md}\n`, images, missingImages, description, plain: $.text() };
}

// ---------------------------------------------------------------- run
mkdirSync(BLOG_DIR, { recursive: true });
mkdirSync(PAGES_DIR, { recursive: true });

const used = new Set();
for (const entry of entries) {
	const { it, permalink } = entry;
	const { md, images, missingImages, description, plain } = await convert(entry);
	const fm = { title: clean(it.title), description };

	if (entry.kind === 'post' || it.slug === PAGE_ARTICLE) {
		const card = homeCards.get(permalink);
		const cardImage = card?.image ? await localizeImage(card.image) : null;
		const thumb = Number(it.meta._thumbnail_id) ? attachments.get(Number(it.meta._thumbnail_id)) : undefined;
		const thumbImage = thumb ? await localizeImage(thumb.attachmentUrl) : null;
		const hero = cardImage ? `${BLOG_REL}/${cardImage}` : thumbImage ? `${BLOG_REL}/${thumbImage}` : images[0]?.replace(PAGES_REL, BLOG_REL);
		const updated = toIso(it.modifiedGmt);
		const pub = toIso(it.dateGmt);
		const categories = it.categories.filter((c) => c.slug !== 'non-classe').map((c) => c.name);
		const tagSource = it.slug === PAGE_ARTICLE ? posts.find((p) => p.slug === DUPLICATE_POST) : it;
		Object.assign(fm, {
			pubDate: pub,
			...(updated && Math.abs(new Date(updated) - new Date(pub)) > 86400000 ? { updatedDate: updated } : {}),
			slug: it.slug,
			permalink,
			lang: detectLang(it.slug, plain),
			...(card ? { section: card.section, homeOrder: card.order } : {}),
			categories,
			tags: tagSource.tags.map((t) => t.name),
			...(hero ? { heroImage: hero } : {}),
			...(hero && md.includes(`(${hero})`) ? { hideHero: true } : {}),
			...(TRANSLATIONS[it.slug] ? { translationOf: TRANSLATIONS[it.slug] } : {}),
			...(it.slug === DUPLICATE_POST ? { canonicalPermalink: byPath.get(normPath(`/${PAGE_ARTICLE}`)) } : {}),
			...(missingImages ? { missingImages } : {}),
			originalUrl: it.link,
		});
		if (!card) report.unmappedFromHome.push(`${it.slug} (${permalink})`);
		used.add(it.slug);
		const front = Object.entries(fm).map(([k, v]) => `${k}: ${yaml(v)}`).join('\n');
		writeFileSync(join(BLOG_DIR, `${it.slug}.md`), `---\n${front}\n---\n\n${md}`);
	} else {
		Object.assign(fm, { slug: it.slug, permalink, originalUrl: it.link });
		const front = Object.entries(fm).map(([k, v]) => `${k}: ${yaml(v)}`).join('\n');
		writeFileSync(join(PAGES_DIR, `${it.slug}.md`), `---\n${front}\n---\n\n${md}`);
	}
}

// assets used directly by the Astro layout/home page
const extras = [];
for (const id of [57, 140]) if (attachments.has(id)) extras.push(attachments.get(id).attachmentUrl);
for (const u of extras) await localizeImage(u);

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, '\t')}\n`);
console.log(`Imported ${entries.length} entries (${used.size} posts).`);
for (const [k, v] of Object.entries(report)) console.log(`\n## ${k} (${[...new Set(v)].length})\n${[...new Set(v)].join('\n')}`);
