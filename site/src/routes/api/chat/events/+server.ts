import type { RequestHandler } from './$types';
import {
	tryAddConnection,
	removeConnection,
	refreshClusterLease,
	HEARTBEAT_INTERVAL
} from '$lib/server/sse/chat-connections';
import { validateSessionForChatStream, hasPermission, isAdmin } from '$lib/server/auth';
import { hasOrderChatPermission } from '$lib/server/permissions/orders';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const orderId = url.searchParams.get('orderId');

	if (!orderId) {
		return new Response('Missing orderId', { status: 400 });
	}

	const sessionId = cookies.get('session_id');
	if (!sessionId) {
		return new Response('Unauthorized', { status: 401 });
	}

	const user = await validateSessionForChatStream(sessionId);
	if (!user) {
		return new Response('Unauthorized', { status: 401 });
	}

	const canChat =
		hasPermission(user, 'chat_customers') ||
		isAdmin(user) ||
		await hasOrderChatPermission(user.id, orderId);

	if (!canChat) {
		return new Response('Forbidden', { status: 403 });
	}

	let controller: ReadableStreamDefaultController;
	let heartbeatInterval: ReturnType<typeof setInterval>;
	let isClosed = false;

	const stream = new ReadableStream({
		async start(ctrl) {
			controller = ctrl;

			const accepted = await tryAddConnection(orderId, controller);
			if (!accepted) {
				isClosed = true;
				try {
					controller.enqueue(new TextEncoder().encode('event: error\ndata: {"type":"limit_exceeded"}\n\n'));
				} catch {
					// Client already gone.
				}
				try {
					controller.close();
				} catch {
					// Already closed.
				}
				return;
			}

			try {
				controller.enqueue(new TextEncoder().encode('data: {"type":"connected"}\n\n'));
			} catch {
				isClosed = true;
			}

			heartbeatInterval = setInterval(() => {
				if (isClosed) {
					clearInterval(heartbeatInterval);
					return;
				}
				try {
					controller.enqueue(new TextEncoder().encode('data: {"type":"heartbeat"}\n\n'));
					void refreshClusterLease(orderId, controller);
				} catch {
					isClosed = true;
					clearInterval(heartbeatInterval);
					removeConnection(orderId, controller);
				}
			}, HEARTBEAT_INTERVAL);
		},
		cancel() {
			isClosed = true;
			clearInterval(heartbeatInterval);
			removeConnection(orderId, controller);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
