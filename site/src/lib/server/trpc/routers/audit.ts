import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq, desc, and, gte, lte, like, or, count, sql } from 'drizzle-orm';
import { adminProcedure, t } from '../trpc';

export const auditRouter = t.router({
	list: adminProcedure
		.input((v) => {
			const s = Type.Object({
				page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
				perPage: Type.Optional(Type.Number({ minimum: 10, maximum: 100, default: 25 })),
				action: Type.Optional(Type.String()),
				userId: Type.Optional(Type.String()),
				search: Type.Optional(Type.String()),
				dateFrom: Type.Optional(Type.String()),
				dateTo: Type.Optional(Type.String())
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as {
				page?: number;
				perPage?: number;
				action?: string;
				userId?: string;
				search?: string;
				dateFrom?: string;
				dateTo?: string;
			};
		})
		.query(async ({ input }) => {
			const page = input.page ?? 1;
			const perPage = input.perPage ?? 25;
			const offset = (page - 1) * perPage;

			const conditions = [];

			if (input.action) {
				conditions.push(eq(schema.auditLogs.action, input.action));
			}

			if (input.userId) {
				conditions.push(eq(schema.auditLogs.userId, input.userId));
			}

			if (input.dateFrom) {
				conditions.push(gte(schema.auditLogs.createdAt, new Date(input.dateFrom)));
			}

			if (input.dateTo) {
				const endDate = new Date(input.dateTo);
				endDate.setHours(23, 59, 59, 999);
				conditions.push(lte(schema.auditLogs.createdAt, endDate));
			}

			if (input.search) {
				const searchPattern = `%${input.search}%`;
				conditions.push(
					or(
						like(schema.auditLogs.targetType, searchPattern),
						like(schema.auditLogs.targetId, searchPattern),
						like(sql<string>`${schema.auditLogs.details}::text`, searchPattern)
					)!
				);
			}

			const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

			const [logs, totalResult] = await Promise.all([
				db
					.select({
						id: schema.auditLogs.id,
						userId: schema.auditLogs.userId,
						action: schema.auditLogs.action,
						targetType: schema.auditLogs.targetType,
						targetId: schema.auditLogs.targetId,
						details: schema.auditLogs.details,
						ipAddress: schema.auditLogs.ipAddress,
						createdAt: schema.auditLogs.createdAt,
						username: schema.users.username
					})
					.from(schema.auditLogs)
					.leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
					.where(whereClause)
					.orderBy(desc(schema.auditLogs.createdAt))
					.limit(perPage)
					.offset(offset),
				db
					.select({ total: count() })
					.from(schema.auditLogs)
					.where(whereClause)
			]);

			const total = totalResult[0]?.total ?? 0;

			return {
				logs: logs.map((log) => ({
					...log,
					details: log.details,
					username: log.username ?? null
				})),
				total,
				page,
				perPage,
				totalPages: Math.ceil(total / perPage)
			};
		}),

	getActions: adminProcedure.query(async () => {
		const actions = await db
			.selectDistinct({ action: schema.auditLogs.action })
			.from(schema.auditLogs)
			.orderBy(schema.auditLogs.action);

		return actions.map((a) => a.action);
	}),

	getUsers: adminProcedure.query(async () => {
		const users = await db
			.selectDistinct({
				id: schema.users.id,
				username: schema.users.username
			})
			.from(schema.users)
			.innerJoin(schema.auditLogs, eq(schema.auditLogs.userId, schema.users.id))
			.orderBy(schema.users.username);

		return users;
	})
});
