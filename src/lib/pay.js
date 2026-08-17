import { writable } from 'svelte/store';

export const pay = writable({ open: false, id: null });

export function openPay(id) {
	pay.set({ open: true, id });
}

export function closePay() {
	pay.update((p) => ({ ...p, open: false }));
}
