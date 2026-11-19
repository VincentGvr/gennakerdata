import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			slug: z.string(),
			// Original WordPress permalink, kept as the public URL
			permalink: z.string().regex(/^\/.+\/$/),
			lang: z.enum(['fr', 'en']).default('fr'),
			// Home page section and order (posts without section only appear in the archive)
			section: z.string().optional(),
			homeOrder: z.number().optional(),
			categories: z.array(z.string()).default([]),
			tags: z.array(z.string()).default([]),
			heroImage: z.optional(image()),
			// The hero image is already part of the article body: only use it for cards and previews
			hideHero: z.boolean().default(false),
			translationOf: z.string().optional(),
			canonicalPermalink: z.string().optional(),
			// Number of illustrations that could not be recovered during the migration
			missingImages: z.number().default(0),
			originalUrl: z.string().optional(),
		}),
});

export const collections = { blog };
