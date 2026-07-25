import { writable } from 'svelte/store';

export const booking = writable({ open: false, item: 'a class' });

export function openBooking(item = 'a class') {
	booking.set({ open: true, item });
}

export function closeBooking() {
	booking.update((b) => ({ ...b, open: false }));
}
