import { db } from '../../../db';
import * as schema from '../../../db/schema';
import { eq, asc } from 'drizzle-orm';
import { internalProcedure } from '../../trpc';

export const dataProcedures = {
	getMarkers: internalProcedure.query(async () => {
		return await db.select().from(schema.stackMarkers);
	}),

	getPaymentMethods: internalProcedure.query(async () => {
		return await db
			.select({
				id: schema.paymentMethods.id,
				name: schema.paymentMethods.name,
				details: schema.paymentMethods.details
			})
			.from(schema.paymentMethods)
			.where(eq(schema.paymentMethods.isActive, true))
			.orderBy(asc(schema.paymentMethods.sortOrder));
	}),

	getProgrammersForNotification: internalProcedure.query(async () => {
		const programmers = await db
			.select({
				userId: schema.users.id,
				username: schema.users.username,
				telegramId: schema.users.telegramId
			})
			.from(schema.users)
			.innerJoin(schema.userRoles, eq(schema.users.id, schema.userRoles.userId))
			.innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
			.where(eq(schema.roles.name, 'Programmer'));

		return programmers.filter((p: { userId: string; username: string; telegramId: string | null }) => p.telegramId);
	})
};
