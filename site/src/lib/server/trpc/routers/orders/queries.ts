import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';

export async function getPaymentMethod(paymentMethodId: string | null) {
	if (!paymentMethodId) return null;
	const result = await db
		.select({
			id: schema.paymentMethods.id,
			name: schema.paymentMethods.name,
			details: schema.paymentMethods.details
		})
		.from(schema.paymentMethods)
		.where(eq(schema.paymentMethods.id, paymentMethodId))
		.limit(1);
	return result[0] || null;
}

export async function getOrderMarkers(orderId: string) {
	return await db
		.select({
			id: schema.stackMarkers.id,
			name: schema.stackMarkers.name,
			color: schema.stackMarkers.color
		})
		.from(schema.orderMarkers)
		.innerJoin(schema.stackMarkers, eq(schema.orderMarkers.markerId, schema.stackMarkers.id))
		.where(eq(schema.orderMarkers.orderId, orderId));
}

export async function getAssignedUser(assignedToId: string | null) {
	if (!assignedToId) return null;
	const result = await db
		.select({ id: schema.users.id, username: schema.users.username })
		.from(schema.users)
		.where(eq(schema.users.id, assignedToId))
		.limit(1);
	return result[0] || null;
}

export async function getUserMarkers(userId: string) {
	return await db
		.select({
			id: schema.stackMarkers.id,
			name: schema.stackMarkers.name,
			color: schema.stackMarkers.color
		})
		.from(schema.userMarkers)
		.innerJoin(schema.stackMarkers, eq(schema.userMarkers.markerId, schema.stackMarkers.id))
		.where(eq(schema.userMarkers.userId, userId));
}

export async function getOrderResponsesWithUsers(orderId: string) {
	const responses = await db
		.select()
		.from(schema.orderResponses)
		.where(eq(schema.orderResponses.orderId, orderId));

	if (responses.length === 0) return [];

	const userIds = [...new Set(responses.map((r) => r.userId))];

	const respUsers = await db
		.select({ id: schema.users.id, username: schema.users.username })
		.from(schema.users)
		.where(sql`${schema.users.id} IN ${userIds}`);

	const respUserMarkers = await db
		.select({
			userId: schema.userMarkers.userId,
			id: schema.stackMarkers.id,
			name: schema.stackMarkers.name,
			color: schema.stackMarkers.color
		})
		.from(schema.userMarkers)
		.innerJoin(schema.stackMarkers, eq(schema.userMarkers.markerId, schema.stackMarkers.id))
		.where(sql`${schema.userMarkers.userId} IN ${userIds}`);

	const userMap = new Map(respUsers.map((u) => [u.id, u]));
	const markerMap = new Map<string, Array<{ id: string; name: string; color: string }>>();
	for (const m of respUserMarkers) {
		if (!markerMap.has(m.userId)) markerMap.set(m.userId, []);
		markerMap.get(m.userId)!.push({ id: m.id, name: m.name, color: m.color });
	}

	return responses.map((resp) => {
		const respUser = userMap.get(resp.userId);
		return {
			...resp,
			user: respUser ? { ...respUser, markers: markerMap.get(respUser.id) ?? [] } : undefined
		};
	});
}

export async function batchEnrichOrders(orders: (typeof schema.orders.$inferSelect)[]) {
	if (orders.length === 0) return [];

	const orderIds = orders.map((o) => o.id);
	const assignedIds = [...new Set(orders.map((o) => o.assignedToId).filter(Boolean))] as string[];
	const paymentMethodIds = [...new Set(orders.map((o) => o.paymentMethod).filter(Boolean))] as string[];

	const [allMarkers, allAssigned, allPaymentMethods, allResponses] = await Promise.all([
		db.select({
			orderId: schema.orderMarkers.orderId,
			id: schema.stackMarkers.id,
			name: schema.stackMarkers.name,
			color: schema.stackMarkers.color
		})
		.from(schema.orderMarkers)
		.innerJoin(schema.stackMarkers, eq(schema.orderMarkers.markerId, schema.stackMarkers.id))
		.where(sql`${schema.orderMarkers.orderId} IN ${orderIds}`),

		assignedIds.length > 0
			? db.select({ id: schema.users.id, username: schema.users.username })
				.from(schema.users)
				.where(sql`${schema.users.id} IN ${assignedIds}`)
			: Promise.resolve([]),

		paymentMethodIds.length > 0
			? db.select({ id: schema.paymentMethods.id, name: schema.paymentMethods.name, details: schema.paymentMethods.details })
				.from(schema.paymentMethods)
				.where(sql`${schema.paymentMethods.id} IN ${paymentMethodIds}`)
			: Promise.resolve([]),

		db.select()
			.from(schema.orderResponses)
			.where(sql`${schema.orderResponses.orderId} IN ${orderIds}`)
	]);

	const markersByOrder = new Map<string, Array<{ id: string; name: string; color: string }>>();
	for (const m of allMarkers) {
		if (!markersByOrder.has(m.orderId)) markersByOrder.set(m.orderId, []);
		markersByOrder.get(m.orderId)!.push({ id: m.id, name: m.name, color: m.color });
	}

	const assignedMap = new Map(allAssigned.map((u) => [u.id, u]));
	const paymentMap = new Map(allPaymentMethods.map((p) => [p.id, p]));

	// Batch-load response users and their markers
	const respUserIds = [...new Set(allResponses.map((r) => r.userId))];
	const [respUsers, respUserMarkers] = await Promise.all([
		respUserIds.length > 0
			? db.select({ id: schema.users.id, username: schema.users.username })
				.from(schema.users)
				.where(sql`${schema.users.id} IN ${respUserIds}`)
			: Promise.resolve([]),
		respUserIds.length > 0
			? db.select({
				userId: schema.userMarkers.userId,
				id: schema.stackMarkers.id,
				name: schema.stackMarkers.name,
				color: schema.stackMarkers.color
			})
			.from(schema.userMarkers)
			.innerJoin(schema.stackMarkers, eq(schema.userMarkers.markerId, schema.stackMarkers.id))
			.where(sql`${schema.userMarkers.userId} IN ${respUserIds}`)
			: Promise.resolve([])
	]);

	const respUserMap = new Map(respUsers.map((u) => [u.id, u]));
	const respMarkerMap = new Map<string, Array<{ id: string; name: string; color: string }>>();
	for (const m of respUserMarkers) {
		if (!respMarkerMap.has(m.userId)) respMarkerMap.set(m.userId, []);
		respMarkerMap.get(m.userId)!.push({ id: m.id, name: m.name, color: m.color });
	}

	const responsesByOrder = new Map<string, Array<typeof allResponses[number] & { user?: { id: string; username: string; markers: Array<{ id: string; name: string; color: string }> } }>>();
	for (const resp of allResponses) {
		if (!responsesByOrder.has(resp.orderId)) responsesByOrder.set(resp.orderId, []);
		const respUser = respUserMap.get(resp.userId);
		responsesByOrder.get(resp.orderId)!.push({
			...resp,
			user: respUser ? { ...respUser, markers: respMarkerMap.get(respUser.id) ?? [] } : undefined
		});
	}

	return orders.map((order) => ({
		...order,
		markers: markersByOrder.get(order.id) ?? [],
		assignedTo: order.assignedToId ? assignedMap.get(order.assignedToId) ?? null : null,
		responses: responsesByOrder.get(order.id) ?? [],
		paymentMethodDetails: order.paymentMethod ? paymentMap.get(order.paymentMethod) ?? null : null
	}));
}

export async function batchEnrichKanbanOrders(orders: (typeof schema.orders.$inferSelect)[]) {
	if (orders.length === 0) return [];

	const orderIds = orders.map((o) => o.id);
	const assignedIds = [...new Set(orders.map((o) => o.assignedToId).filter(Boolean))] as string[];

	const [allMarkers, allAssigned] = await Promise.all([
		db.select({
			orderId: schema.orderMarkers.orderId,
			id: schema.stackMarkers.id,
			name: schema.stackMarkers.name,
			color: schema.stackMarkers.color
		})
		.from(schema.orderMarkers)
		.innerJoin(schema.stackMarkers, eq(schema.orderMarkers.markerId, schema.stackMarkers.id))
		.where(sql`${schema.orderMarkers.orderId} IN ${orderIds}`),

		assignedIds.length > 0
			? db.select({ id: schema.users.id, username: schema.users.username })
				.from(schema.users)
				.where(sql`${schema.users.id} IN ${assignedIds}`)
			: Promise.resolve([])
	]);

	const markersByOrder = new Map<string, Array<{ id: string; name: string; color: string }>>();
	for (const marker of allMarkers) {
		if (!markersByOrder.has(marker.orderId)) markersByOrder.set(marker.orderId, []);
		markersByOrder.get(marker.orderId)!.push({
			id: marker.id,
			name: marker.name,
			color: marker.color
		});
	}

	const assignedMap = new Map(allAssigned.map((u) => [u.id, u]));

	return orders.map((order) => ({
		...order,
		markers: markersByOrder.get(order.id) ?? [],
		assignedTo: order.assignedToId ? assignedMap.get(order.assignedToId) ?? null : null
	}));
}

export async function batchEnrichOrdersWithMarkers(orders: (typeof schema.orders.$inferSelect)[]) {
	if (orders.length === 0) return [];

	const orderIds = orders.map((o) => o.id);

	const allMarkers = await db
		.select({
			orderId: schema.orderMarkers.orderId,
			id: schema.stackMarkers.id,
			name: schema.stackMarkers.name,
			color: schema.stackMarkers.color
		})
		.from(schema.orderMarkers)
		.innerJoin(schema.stackMarkers, eq(schema.orderMarkers.markerId, schema.stackMarkers.id))
		.where(sql`${schema.orderMarkers.orderId} IN ${orderIds}`);

	const markersByOrder = new Map<string, Array<{ id: string; name: string; color: string }>>();
	for (const m of allMarkers) {
		if (!markersByOrder.has(m.orderId)) markersByOrder.set(m.orderId, []);
		markersByOrder.get(m.orderId)!.push({ id: m.id, name: m.name, color: m.color });
	}

	return orders.map((order) => ({
		...order,
		markers: markersByOrder.get(order.id) ?? []
	}));
}
