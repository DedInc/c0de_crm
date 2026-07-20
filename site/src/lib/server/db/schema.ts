import {
	pgTable,
	text,
	timestamp,
	pgEnum,
	boolean,
	numeric,
	integer,
	jsonb,
	index,
	uniqueIndex
} from 'drizzle-orm/pg-core';

// Enums for PostgreSQL
export const orderStatusEnum = pgEnum('order_status', ['pending_moderation', 'rejected', 'approved', 'in_progress', 'testing', 'completed', 'delivered']);
export const senderTypeEnum = pgEnum('sender_type', ['staff', 'customer']);
export const languageEnum = pgEnum('language', ['en', 'ru']);
export const orderPermissionEnum = pgEnum('order_permission', ['chat_customers']);

// Users table
export const users = pgTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	telegramId: text('telegram_id'),
	mustChangePassword: boolean('must_change_password').notNull().default(false),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
});

// Roles table
export const roles = pgTable('roles', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	description: text('description'),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
});

// Permissions table
export const permissions = pgTable('permissions', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	description: text('description')
});

// Role permissions junction table
export const rolePermissions = pgTable(
	'role_permissions',
	{
		roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
		permissionId: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' })
	},
	(table) => [
		uniqueIndex('role_permissions_role_id_permission_id_idx').on(table.roleId, table.permissionId),
		index('role_permissions_permission_id_idx').on(table.permissionId)
	]
);

// User roles junction table
export const userRoles = pgTable(
	'user_roles',
	{
		userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
		roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' })
	},
	(table) => [
		uniqueIndex('user_roles_user_id_role_id_idx').on(table.userId, table.roleId),
		index('user_roles_role_id_idx').on(table.roleId)
	]
);

// User markers junction table (links users to stack markers for their skills)
export const userMarkers = pgTable(
	'user_markers',
	{
		userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
		markerId: text('marker_id').notNull().references(() => stackMarkers.id, { onDelete: 'cascade' })
	},
	(table) => [
		uniqueIndex('user_markers_user_id_marker_id_idx').on(table.userId, table.markerId),
		index('user_markers_marker_id_idx').on(table.markerId)
	]
);

// Stack markers table (global, created by admin)
export const stackMarkers = pgTable('stack_markers', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	color: text('color').notNull(),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
});

// Orders table
export const orders = pgTable(
	'orders',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description').notNull(),
		cost: numeric('cost', { precision: 19, scale: 4, mode: 'number' }).notNull(),
		currency: text('currency').notNull().default('USD'),
		status: orderStatusEnum('status').notNull().default('pending_moderation'),
		paymentMethod: text('payment_method'),
		customerTelegramId: text('customer_telegram_id').notNull(),
		customerName: text('customer_name'),
		assignedToId: text('assigned_to_id').references(() => users.id),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		index('orders_status_idx').on(table.status),
		index('orders_customer_telegram_id_idx').on(table.customerTelegramId),
		index('orders_assigned_to_id_idx').on(table.assignedToId)
	]
);

// Order markers junction table
export const orderMarkers = pgTable(
	'order_markers',
	{
		orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
		markerId: text('marker_id').notNull().references(() => stackMarkers.id, { onDelete: 'cascade' })
	},
	(table) => [
		uniqueIndex('order_markers_order_id_marker_id_idx').on(table.orderId, table.markerId),
		index('order_markers_marker_id_idx').on(table.markerId)
	]
);

// Order responses (programmers responding to orders)
export const orderResponses = pgTable(
	'order_responses',
	{
		id: text('id').primaryKey(),
		orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
		proposedPrice: numeric('proposed_price', { precision: 19, scale: 4, mode: 'number' }).notNull(),
		message: text('message'),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('order_responses_order_id_user_id_idx').on(table.orderId, table.userId),
		index('order_responses_user_id_idx').on(table.userId)
	]
);

// Chat messages table
export const chatMessages = pgTable(
	'chat_messages',
	{
		id: text('id').primaryKey(),
		orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
		senderId: text('sender_id'),
		senderType: senderTypeEnum('sender_type').notNull(),
		message: text('message').notNull(),
		imageUrls: jsonb('image_urls').$type<string[] | null>(),
		fileUrls: jsonb('file_urls').$type<{ url: string; name: string; type: string }[] | null>(),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		index('chat_messages_order_id_created_at_idx').on(table.orderId, table.createdAt),
		index('chat_messages_sender_id_idx').on(table.senderId)
	]
);

// Sessions table
export const sessions = pgTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		index('sessions_user_id_idx').on(table.userId),
		index('sessions_expires_at_idx').on(table.expiresAt)
	]
);

// Telegram users table (for bot users' language preferences)
export const telegramUsers = pgTable('telegram_users', {
	telegramId: text('telegram_id').primaryKey(),
	language: languageEnum('language').notNull().default('en'),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
});

// Payment methods table (admin-managed) - now only stores method types, not actual payment details
export const paymentMethods = pgTable('payment_methods', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	details: text('details').notNull().default(''), // Legacy field - kept for backward compatibility but no longer used
	isActive: boolean('is_active').notNull().default(true),
	isSystem: boolean('is_system').notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
});

// Commission settings table (for calculating programmer payments)
export const commissionSettings = pgTable('commission_settings', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	percentageRate: numeric('percentage_rate', { precision: 7, scale: 4, mode: 'number' }).notNull().default(0),
	fixedAmount: numeric('fixed_amount', { precision: 19, scale: 4, mode: 'number' }).notNull().default(0),
	isDefault: boolean('is_default').notNull().default(false),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
});

// Order-specific payment information (sent by authorized staff when order is in progress)
export const orderPaymentInfo = pgTable('order_payment_info', {
	id: text('id').primaryKey(),
	orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
	providedByUserId: text('provided_by_user_id').notNull().references(() => users.id),
	paymentMethodId: text('payment_method_id').references(() => paymentMethods.id),
	paymentMethodName: text('payment_method_name').notNull(), // Stored separately in case payment method is deleted
	paymentDetails: text('payment_details').notNull(), // The actual card/account/address details
	programmerAmount: numeric('programmer_amount', { precision: 19, scale: 4, mode: 'number' }).notNull(),
	commissionAmount: numeric('commission_amount', { precision: 19, scale: 4, mode: 'number' }).notNull().default(0),
	totalAmount: numeric('total_amount', { precision: 19, scale: 4, mode: 'number' }).notNull(),
	commissionSettingId: text('commission_setting_id').references(() => commissionSettings.id),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
});

// User payment details (programmers can save their payment details for reuse)
export const userPaymentDetails = pgTable(
	'user_payment_details',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
		paymentMethodId: text('payment_method_id').notNull().references(() => paymentMethods.id, { onDelete: 'cascade' }),
		details: text('details').notNull(),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		index('user_payment_details_user_id_idx').on(table.userId),
		index('user_payment_details_payment_method_id_idx').on(table.paymentMethodId)
	]
);

// Order-specific temporary permissions (for delegating chat access, etc.)
export const orderPermissions = pgTable(
	'order_permissions',
	{
		id: text('id').primaryKey(),
		orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
		permission: orderPermissionEnum('permission').notNull(),
		grantedById: text('granted_by_id').notNull().references(() => users.id),
		expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }),
		createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('order_permissions_order_id_user_id_permission_idx').on(
			table.orderId,
			table.userId,
			table.permission
		),
		index('order_permissions_user_id_idx').on(table.userId),
		index('order_permissions_expires_at_idx').on(table.expiresAt)
	]
);

// Currencies table (admin-managed display currencies)
export const currencies = pgTable('currencies', {
	id: text('id').primaryKey(),
	code: text('code').notNull().unique(),
	symbol: text('symbol').notNull(),
	isDefault: boolean('is_default').notNull().default(false),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
});

// Audit logs table
export const auditLogs = pgTable('audit_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
	action: text('action').notNull(),
	targetType: text('target_type').notNull(), // 'user', 'role', 'permission', 'order', 'payment_info'
	targetId: text('target_id'),
	details: jsonb('details').$type<Record<string, unknown> | null>(),
	ipAddress: text('ip_address'),
	createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow()
});

// Types
export type AuditLog = typeof auditLogs.$inferSelect;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type StackMarker = typeof stackMarkers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderResponse = typeof orderResponses.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type TelegramUser = typeof telegramUsers.$inferSelect;
export type OrderPermission = typeof orderPermissions.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type CommissionSetting = typeof commissionSettings.$inferSelect;
export type OrderPaymentInfo = typeof orderPaymentInfo.$inferSelect;
export type UserPaymentDetail = typeof userPaymentDetails.$inferSelect;
export type Currency = typeof currencies.$inferSelect;
