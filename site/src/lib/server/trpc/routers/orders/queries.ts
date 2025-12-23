import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq } from 'drizzle-orm';

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

	const result = [];
	for (const resp of responses) {
		const respUserResult = await db
			.select({ id: schema.users.id, username: schema.users.username })
			.from(schema.users)
			.where(eq(schema.users.id, resp.userId))
			.limit(1);
		const respUser = respUserResult[0];
		
		const userMarkers = respUser ? await getUserMarkers(respUser.id) : [];
		
		result.push({
			...resp,
			user: respUser ? { ...respUser, markers: userMarkers } : respUser
		});
	}
	return result;
}
