/** Svelte action: fade/slide element in when it scrolls into view. */
export function reveal(node) {
	if (typeof IntersectionObserver === 'undefined') {
		node.classList.add('in');
		return;
	}
	const io = new IntersectionObserver(
		(entries) => {
			entries.forEach((e) => {
				if (e.isIntersecting) {
					node.classList.add('in');
					io.unobserve(node);
				}
			});
		},
		{ threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
	);
	io.observe(node);
	return { destroy() { io.disconnect(); } };
}
