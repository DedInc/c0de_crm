import { redirect } from '@sveltejs/kit';
import { validateSession } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
	const sessionId = cookies.get('session_id');
	const user = sessionId ? await validateSession(sessionId) : null;

	if (!user) {
		const next = `${url.pathname}${url.search}`;
		throw redirect(303, `/login?next=${encodeURIComponent(next)}`);
	}

	return { user };
};
