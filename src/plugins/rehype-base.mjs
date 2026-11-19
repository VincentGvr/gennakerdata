// Prefixes root-relative links found in Markdown content with the site base path
// (e.g. /2026/01/26/post/ -> /gennakerdata/2026/01/26/post/) so internal links work on any base.
export function rehypeBase({ base = '/' } = {}) {
	const prefix = base === '/' ? '' : base.replace(/\/$/, '');
	const walk = (node) => {
		if (node.type === 'element' && node.tagName === 'a') {
			const href = node.properties?.href;
			if (
				prefix &&
				typeof href === 'string' &&
				href.startsWith('/') &&
				!href.startsWith('//') &&
				!href.startsWith(prefix + '/')
			) {
				node.properties.href = prefix + href;
			}
		}
		node.children?.forEach(walk);
	};
	return (tree) => walk(tree);
}
