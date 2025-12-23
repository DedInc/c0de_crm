import { TRPCError } from '@trpc/server';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { db } from '../../db';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import { protectedProcedure, permissionProcedure, t } from '../trpc';

export const rolesRouter = t.router({
	list: protectedProcedure.query(async () => {
		const allRoles = await db.select().from(schema.roles);
		const result = [];

		for (const role of allRoles) {
			const perms = await db
				.select({
					permissionId: schema.rolePermissions.permissionId,
					permissionName: schema.permissions.name
				})
				.from(schema.rolePermissions)
				.innerJoin(schema.permissions, eq(schema.rolePermissions.permissionId, schema.permissions.id))
				.where(eq(schema.rolePermissions.roleId, role.id));

			result.push({
				...role,
				permissions: perms
			});
		}

		return result;
	}),

	create: permissionProcedure('manage_roles')
		.input((v) => {
			const s = Type.Object({
				name: Type.String({ minLength: 1 }),
				description: Type.Optional(Type.String()),
				permissionIds: Type.Array(Type.String())
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { name: string; description?: string; permissionIds: string[] };
		})
		.mutation(async ({ input }) => {
			const existingResult = await db.select().from(schema.roles).where(eq(schema.roles.name, input.name)).limit(1);
			if (existingResult[0]) {
				throw new TRPCError({ code: 'CONFLICT', message: 'Role name already exists' });
			}

			const roleId = crypto.randomUUID();
			await db.insert(schema.roles)
				.values({
					id: roleId,
					name: input.name,
					description: input.description || null,
					createdAt: new Date()
				});

			for (const permId of input.permissionIds) {
				await db.insert(schema.rolePermissions).values({ roleId, permissionId: permId });
			}

			return { id: roleId };
		}),

	update: permissionProcedure('manage_roles')
		.input((v) => {
			const s = Type.Object({
				id: Type.String(),
				name: Type.Optional(Type.String({ minLength: 1 })),
				description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
				permissionIds: Type.Optional(Type.Array(Type.String()))
			});
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { id: string; name?: string; description?: string | null; permissionIds?: string[] };
		})
		.mutation(async ({ input }) => {
			const roleResult = await db.select().from(schema.roles).where(eq(schema.roles.id, input.id)).limit(1);
			const role = roleResult[0];
			if (!role) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Role not found' });
			}

			if (input.name || input.description !== undefined) {
				await db.update(schema.roles)
					.set({
						name: input.name || role.name,
						description: input.description !== undefined ? input.description : role.description
					})
					.where(eq(schema.roles.id, input.id));
			}

			if (input.permissionIds) {
				await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, input.id));
				for (const permId of input.permissionIds) {
					await db.insert(schema.rolePermissions).values({ roleId: input.id, permissionId: permId });
				}
			}

			return { success: true };
		}),

	delete: permissionProcedure('manage_roles')
		.input((v) => {
			const s = Type.Object({ id: Type.String() });
			const check = TypeCompiler.Compile(s);
			if (!check.Check(v)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid input' });
			return v as { id: string };
		})
		.mutation(async ({ input }) => {
			const roleResult = await db.select().from(schema.roles).where(eq(schema.roles.id, input.id)).limit(1);
			const role = roleResult[0];
			if (role?.name === 'Administrator') {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete Administrator role' });
			}
			await db.delete(schema.roles).where(eq(schema.roles.id, input.id));
			return { success: true };
		})
});

export const permissionsRouter = t.router({
	list: protectedProcedure.query(async () => {
		return await db.select().from(schema.permissions);
	})
});