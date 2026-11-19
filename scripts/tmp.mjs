import { parseExport } from './parse-export.mjs';
const { title, link, items } = parseExport(process.argv[2]);
console.log(title, link);
for (const i of items.filter(i=>i.type==='post'&&i.status==='publish')) console.log(i.id, i.slug, i.dateGmt, '|cats', i.categories.map(c=>c.slug).join(','), '|tags', i.tags.map(c=>c.slug).join(','), '|thumb', i.meta._thumbnail_id, '|exc', i.excerpt.slice(0,60).replace(/\s+/g,' '));
