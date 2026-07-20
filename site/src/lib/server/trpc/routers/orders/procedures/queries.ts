import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../../../db';
import * as schema from '../../../../db/schema';
import { eq, desc, and, or, ilike, sql, count, exists, inArray } from 'drizzle-orm';
import { permissionProcedure } from '../../../trpc';
import { cacheGetOrSet, CacheKeys, CacheTTL } from '../../../../cache';
import {
	batchEnrichOrders,
	batchEnrichKanbanOrders,
	getOrderMarkers,
	getAssignedUser,
	getOrderResponsesWithUsers,
	getPaymentMethod
} from '../helpers';

export const list = permissionProcedure('view_orders').query(async () => {
	return cacheGetOrSet(
		CacheKeys.ordersList(),
		async () => {
			const allOrders = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt));
			return batchEnrichOrders(allOrders);
		},
		CacheTTL.SHORT
	);
});

const kanbanStatuses = ['approved', 'in_progress', 'testing', 'completed'] as const;
const DEFAULT_KANBAN_LIMIT_PER_STATUS = 50;

const listKanbanSchema = Type.Object({
	limitPerStatus: Type.Optional(Type.Number({ minimum: 1, maximum: 100 }))
});
const listKanbanCheck = TypeCompiler.Compile(listKanbanSchema);

export const listKanban = permissionProcedure('view_orders')
	.input((v) => {
		if (v === undefined) return { limitPerStatus: DEFAULT_KANBAN_LIMIT_PER_STATUS };
		if (!listKanbanCheck.Check(v)) {
			throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		}
		const input = v as { limitPerStatus?: number };
		return { limitPerStatus: input.limitPerStatus ?? DEFAULT_KANBAN_LIMIT_PER_STATUS };
	})
	.query(async ({ input }) => {
		const [ordersByStatus, countRows] = await Promise.all([
			Promise.all(
				kanbanStatuses.map((status) =>
					db
						.select()
						.from(schema.orders)
						.where(eq(schema.orders.status, status))
						.orderBy(desc(schema.orders.createdAt))
						.limit(input.limitPerStatus)
				)
			),
			db
				.select({ status: schema.orders.status, count: count() })
				.from(schema.orders)
				.where(inArray(schema.orders.status, kanbanStatuses))
				.groupBy(schema.orders.status)
		]);

		const totals: Record<typeof kanbanStatuses[number], number> = {
			approved: 0,
			in_progress: 0,
			testing: 0,
			completed: 0
		};

		for (const row of countRows) {
			if (kanbanStatuses.includes(row.status as typeof kanbanStatuses[number])) {
				totals[row.status as typeof kanbanStatuses[number]] = row.count;
			}
		}

		return {
			items: await batchEnrichKanbanOrders(ordersByStatus.flat()),
			totals,
			limitPerStatus: input.limitPerStatus
		};
	});

const listPaginatedSchema = Type.Object({
	page: Type.Number({ minimum: 1 }),
	pageSize: Type.Number({ minimum: 1, maximum: 100 }),
	search: Type.Optional(Type.String()),
	status: Type.Optional(Type.String()),
	markerId: Type.Optional(Type.String())
});
const listPaginatedCheck = TypeCompiler.Compile(listPaginatedSchema);

export const listPaginated = permissionProcedure('view_orders')
	.input((v) => {
		if (!listPaginatedCheck.Check(v))
			throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as { page: number; pageSize: number; search?: string; status?: string; markerId?: string };
	})
	.query(async ({ input }) => {
		const { page, pageSize, search, status, markerId } = input;

		const conditions = [];

		if (status) {
			conditions.push(eq(schema.orders.status, status as typeof schema.orders.status.enumValues[number]));
		}

		if (search) {
			const pattern = `%${search}%`;
			conditions.push(
				or(
					ilike(schema.orders.title, pattern),
					ilike(schema.orders.description, pattern)
				)!
			);
		}

		if (markerId) {
			conditions.push(
				exists(
					db.select({ one: sql`1` })
						.from(schema.orderMarkers)
						.where(
							and(
								eq(schema.orderMarkers.orderId, schema.orders.id),
								eq(schema.orderMarkers.markerId, markerId)
							)
						)
				)
			);
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const [items, countResult] = await Promise.all([
			db.select()
				.from(schema.orders)
				.where(whereClause)
				.orderBy(desc(schema.orders.createdAt))
				.limit(pageSize)
				.offset((page - 1) * pageSize),
			db.select({ total: count() })
				.from(schema.orders)
				.where(whereClause)
		]);

		const enrichedItems = await batchEnrichOrders(items);
		const totalCount = countResult[0]?.total ?? 0;

		return { items: enrichedItems, totalCount };
	});

export const getStats = permissionProcedure('view_orders').query(async () => {
	return cacheGetOrSet(
		CacheKeys.ordersPending(),
		async () => {
			const rows = await db
				.select({ status: schema.orders.status, count: count() })
				.from(schema.orders)
				.groupBy(schema.orders.status);

			let total = 0;
			let pendingModeration = 0;
			let inProgress = 0;
			let completed = 0;

			for (const row of rows) {
				total += row.count;
				if (row.status === 'pending_moderation') pendingModeration = row.count;
				if (row.status === 'in_progress') inProgress = row.count;
				if (row.status === 'completed' || row.status === 'delivered') completed += row.count;
			}

			return { total, pendingModeration, inProgress, completed };
		},
		CacheTTL.SHORT
	);
});

export const getById = permissionProcedure('view_orders')
	.input((v) => {
		const s = Type.Object({ id: Type.String() });
		const check = TypeCompiler.Compile(s);
		if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
		return v as { id: string };
	})
	.query(async ({ input }) => {
		const orderResult = await db.select().from(schema.orders).where(eq(schema.orders.id, input.id)).limit(1);
		const order = orderResult[0];
		if (!order) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
		}

		const [markers, assignedTo, responses, paymentMethodDetails] = await Promise.all([
			getOrderMarkers(order.id),
			getAssignedUser(order.assignedToId),
			getOrderResponsesWithUsers(order.id),
			getPaymentMethod(order.paymentMethod)
		]);

		return {
			...order,
			markers,
			assignedTo,
			responses,
			paymentMethodDetails
		};
	});
