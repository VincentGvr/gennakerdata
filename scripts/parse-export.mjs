import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const arr = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Parse a WordPress WXR export into plain objects. */
export function parseExport(file) {
	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: '@_',
		cdataPropName: false,
		parseTagValue: false,
		trimValues: false,
	});
	const xml = parser.parse(readFileSync(file, 'utf8'));
	const channel = xml.rss.channel;
	const items = arr(channel.item).map((it) => {
		const meta = {};
		for (const m of arr(it['wp:postmeta'])) meta[m['wp:meta_key']] = m['wp:meta_value'];
		const cats = arr(it.category);
		return {
			id: Number(it['wp:post_id']),
			type: it['wp:post_type'],
			status: it['wp:status'],
			title: String(it.title ?? ''),
			link: it.link,
			slug: it['wp:post_name'] ?? '',
			date: it['wp:post_date'],
			dateGmt: it['wp:post_date_gmt'],
			modifiedGmt: it['wp:post_modified_gmt'],
			modified: it['wp:post_modified'],
			parent: Number(it['wp:post_parent'] ?? 0),
			content: it['content:encoded'] ?? '',
			excerpt: it['excerpt:encoded'] ?? '',
			attachmentUrl: it['wp:attachment_url'],
			categories: cats.filter((c) => c['@_domain'] === 'category').map((c) => ({ slug: c['@_nicename'], name: c['#text'] })),
			tags: cats.filter((c) => c['@_domain'] === 'post_tag').map((c) => ({ slug: c['@_nicename'], name: c['#text'] })),
			meta,
		};
	});
	return { title: channel.title, link: channel.link, items };
}
