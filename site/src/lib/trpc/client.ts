import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '$lib/server/trpc/router';
import { browser } from '$app/environment';

function createClient() {
	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				url: '/api/trpc',
				fetch(url, options) {
					return fetch(url, {
						...options,
						credentials: 'include'
					});
				}
			})
		]
	});
}

// Only create the client in the browser to avoid SSR fetch issues
export const trpc = browser
	? createClient()
	: (new Proxy({} as ReturnType<typeof createClient>, {
			get: () => {
				return new Proxy(() => {}, {
					get: () => () => {
						throw new Error('tRPC client cannot be used during SSR');
					},
					apply: () => {
						throw new Error('tRPC client cannot be used during SSR');
					}
				});
			}
		}) as ReturnType<typeof createClient>);