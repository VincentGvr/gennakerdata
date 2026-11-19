// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import { rehypeBase } from './src/plugins/rehype-base.mjs';

// Deployment target, switchable through environment variables:
//   preview (default): SITE=https://vincentgvr.github.io  BASE_PATH=/gennakerdata
//   custom domain:     SITE=https://gennakerdata.com      BASE_PATH=/
const site = (process.env.SITE || 'https://vincentgvr.github.io').replace(/\/$/, '');
const rawBase = process.env.BASE_PATH ?? '/gennakerdata';
const base = rawBase === '/' || rawBase === '' ? '/' : '/' + rawBase.replace(/^\/+|\/+$/g, '');

// Legacy WordPress URLs: slug-only URLs and /gennaker-data/ keep working through redirects
// (Astro prefixes the redirect sources with the base path but not the destinations, hence `to`).
const to = (/** @type {string} */ p) => (base === '/' ? p : base + p);
/** @type {Record<string, string>} */
const redirects = { '/gennaker-data/': to('/') };
const blogDir = path.resolve('src/content/blog');
for (const file of fs.readdirSync(blogDir).filter((f) => f.endsWith('.md'))) {
	const raw = fs.readFileSync(path.join(blogDir, file), 'utf8');
	const slug = raw.match(/^slug: "(.+)"$/m)?.[1];
	const permalink = raw.match(/^permalink: "(.+)"$/m)?.[1];
	if (slug && permalink && `/${slug}/` !== permalink) redirects[`/${slug}/`] = to(permalink);
}

// https://astro.build/config
export default defineConfig({
	site,
	base,
	trailingSlash: 'always',
	redirects,
	integrations: [mdx(), sitemap()],
	markdown: {
		processor: unified({
			rehypePlugins: [[rehypeBase, { base }]],
		}),
		shikiConfig: {
			themes: { light: 'github-light', dark: 'github-dark' },
			defaultColor: false,
		},
	},
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
