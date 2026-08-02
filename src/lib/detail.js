import { writable } from 'svelte/store';

export const detail = writable({ open: false });

export function openDetail(payload) {
	detail.set({ open: true, ...payload });
}

export function closeDetail() {
	detail.update((d) => ({ ...d, open: false }));
}
