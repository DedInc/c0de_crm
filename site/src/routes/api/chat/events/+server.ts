import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { addConnection, removeConnection, HEARTBEAT_INTERVAL } from '$lib/server/sse/chat-connections';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const orderId = url.searchParams.get('orderId');
	
	if (!orderId) {
		return new Response('Missing orderId', { status: 400 });
	}

	// Verify session
	const sessionId = cookies.get('session');
	if (!sessionId) {
		return new Response('Unauthorized', { status: 401 });
	}

	const sessionResult = await db
		.select()
		.from(schema.sessions)
		.where(eq(schema.sessions.id, sessionId))
		.limit(1);
	const session = sessionResult[0];

	if (!session || new Date(session.expiresAt) < new Date()) {
		return new Response('Unauthorized', { status: 401 });
	}

	let controller: ReadableStreamDefaultController;
	let heartbeatInterval: ReturnType<typeof setInterval>;
	let isClosed = false;

	const stream = new ReadableStream({
		start(ctrl) {
			controller = ctrl;
			
			// Add to connections
			addConnection(orderId, controller);

			// Send initial ping
			try {
				controller.enqueue(new TextEncoder().encode('data: {"type":"connected"}\n\n'));
			} catch {
				isClosed = true;
			}
			
			// Start heartbeat to keep connection alive
			heartbeatInterval = setInterval(() => {
				if (isClosed) {
					clearInterval(heartbeatInterval);
					return;
				}
				try {
					controller.enqueue(new TextEncoder().encode('data: {"type":"heartbeat"}\n\n'));
				} catch {
					isClosed = true;
					clearInterval(heartbeatInterval);
					// Clean up connection
					removeConnection(orderId, controller);
				}
			}, HEARTBEAT_INTERVAL);
		},
		cancel() {
			isClosed = true;
			clearInterval(heartbeatInterval);
			// Remove from connections
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