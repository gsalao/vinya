import { redirect } from '@sveltejs/kit';
import { ADMIN_BASE } from '$lib/admin/paths.js';
export const load = () => { throw redirect(303, `${ADMIN_BASE}/home`); };
