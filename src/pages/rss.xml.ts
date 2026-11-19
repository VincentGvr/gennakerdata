import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getPosts, withBase } from '../utils';

export async function GET(context: APIContext) {
	// Only the canonical copy of each article is published in the feed.
	const posts = (await getPosts()).filter((p) => !p.data.canonicalPermalink);
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site!,
		customData: '<language>fr-FR</language>',
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: withBase(post.data.permalink),
			categories: [...post.data.categories, ...post.data.tags],
		})),
	});
}
