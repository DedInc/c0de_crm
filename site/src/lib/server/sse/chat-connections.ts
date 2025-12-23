// Store active SSE connections per order
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

// Heartbeat interval to keep connections alive (15 seconds)
export const HEARTBEAT_INTERVAL = 15000;

// Function to notify all connections for an order
export function notifyNewMessage(orderId: string, message: unknown) {
	const orderConnections = connections.get(orderId);
	if (orderConnections) {
		const data = `data: ${JSON.stringify(message)}\n\n`;
		const deadControllers: ReadableStreamDefaultController[] = [];
		
		for (const controller of orderConnections) {
			try {
				controller.enqueue(new TextEncoder().encode(data));
			} catch {
				// Connection closed, mark for cleanup
				deadControllers.push(controller);
			}
		}
		
		// Clean up dead connections
		for (const controller of deadControllers) {
			orderConnections.delete(controller);
		}
		
		if (orderConnections.size === 0) {
			connections.delete(orderId);
		}
	}
}

export function addConnection(orderId: string, controller: ReadableStreamDefaultController) {
	if (!connections.has(orderId)) {
		connections.set(orderId, new Set());
	}
	connections.get(orderId)!.add(controller);
}

export function removeConnection(orderId: string, controller: ReadableStreamDefaultController) {
	const orderConnections = connections.get(orderId);
	if (orderConnections) {
		orderConnections.delete(controller);
		if (orderConnections.size === 0) {
			connections.delete(orderId);
		}
	}
}