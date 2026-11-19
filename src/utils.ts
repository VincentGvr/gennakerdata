import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** Prefix a root-relative path with the configured base path. */
export function withBase(p: string): string {
	const base = import.meta.env.BASE_URL.replace(/\/$/, '');
	if (/^[a-z]+:/i.test(p) || p.startsWith('//')) return p;
	return base + (p.startsWith('/') ? p : '/' + p);
}

export async function getPosts(): Promise<Post[]> {
	const posts = await getCollection('blog');
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export const postPath = (post: Post) => post.data.permalink;
export const postHref = (post: Post) => withBase(post.data.permalink);

export function readingTime(markdown: string | undefined): number {
	const text = (markdown ?? '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/<[^>]+>/g, ' ');
	const words = text.split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / 220));
}

export function slugify(s: string): string {
	return s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function categoryHref(name: string): string {
	return withBase(`/category/${slugify(name)}/`);
}

export function formatDate(date: Date, lang: 'fr' | 'en' = 'fr'): string {
	return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	});
}
