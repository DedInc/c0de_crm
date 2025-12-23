import { pgTable, text, real, timestamp, pgEnum, boolean } from 'drizzle-orm/pg-core';

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
	createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).notNull()
});

// Roles table
export const roles = pgTable('roles', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	description: text('description'),
	createdAt: timestamp('created_at', { mode: 'date' }).notNull()
});

// Permissions table
export const permissions = pgTable('permissions', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	description: text('description')
});

// Role permissions junction table
export const rolePermissions = pgTable('role_permissions', {
	roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
	permissionId: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' })
});

// User roles junction table
export const userRoles = pgTable('user_roles', {
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' })
});

// User markers junction table (links users to stack markers for their skills)
export const userMarkers = pgTable('user_markers', {
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	markerId: text('marker_id').notNull().references(() => stackMarkers.id, { onDelete: 'cascade' })
});

// Stack markers table (global, created by admin)
export const stackMarkers = pgTable('stack_markers', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	color: text('color').notNull(),
	createdAt: timestamp('created_at', { mode: 'date' }).notNull()
});

// Orders table
export const orders = pgTable('orders', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').notNull(),
	cost: real('cost').notNull(),
	status: orderStatusEnum('status').notNull().default('pending_moderation'),
	paymentMethod: text('payment_method'),
	customerTelegramId: text('customer_telegram_id').notNull(),
	customerName: text('customer_name'),
	assignedToId: text('assigned_to_id').references(() => users.id),
	createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).notNull()
});

// Order markers junction table
export const orderMarkers = pgTable('order_markers', {
	orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
	markerId: text('marker_id').notNull().references(() => stackMarkers.id, { onDelete: 'cascade' })
});

// Order responses (programmers responding to orders)
export const orderResponses = pgTable('order_responses', {
	id: text('id').primaryKey(),
	orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	proposedPrice: real('proposed_price').notNull(),
	message: text('message'),
	createdAt: timestamp('created_at', { mode: 'date' }).notNull()
});

// Chat messages table
export const chatMessages = pgTable('chat_messages', {
	id: text('id').primaryKey(),
	orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
	senderId: text('sender_id'), // null if from customer via telegram
	senderType: senderTypeEnum('sender_type').notNull(),
	message: text('message').notNull(),
	imageUrls: text('image_urls'), // JSON array of image URLs (Telegram files or uploaded)
	createdAt: timestamp('created_at', { mode: 'date' }).notNull()
});

// Sessions table
export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
	createdAt: timestamp('created_at', { mode: 'date' }).notNull()
});

// Telegram users table (for bot users' language preferences)
export const telegramUsers = pgTable('telegram_users', {
	telegramId: text('telegram_id').primaryKey(),
	language: languageEnum('language').notNull().default('en'),
	createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).notNull()
});

// Payment methods table (admin-managed) - now only stores method types, not actual payment details
export const paymentMethods = pgTable('payment_methods', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	details: text('details').notNull().default(''), // Legacy field - kept for backward compatibility but no longer used
	isActive: boolean('is_active').notNull().default(true),
	sortOrder: real('sort_order').notNull().default(0),
	createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).notNull()
});

// Commission settings table (for calculating programmer payments)
export const commissionSettings = pgTable('commission_settings', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	percentageRate: real('percentage_rate').notNull().default(0),
	fixedAmount: real('fixed_amount').notNull().default(0),
	isDefault: boolean('is_default').notNull().default(false),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).notNull()
});

// Order-specific payment information (sent by authorized staff when order is in progress)
export const orderPaymentInfo = pgTable('order_payment_info', {
	id: text('id').primaryKey(),
	orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
	providedByUserId: text('provided_by_user_id').notNull().references(() => users.id),
	paymentMethodId: text('payment_method_id').references(() => paymentMethods.id),
	paymentMethodName: text('payment_method_name').notNull(), // Stored separately in case payment method is deleted
	paymentDetails: text('payment_details').notNull(), // The actual card/account/address details
	programmerAmount: real('programmer_amount').notNull(), // Amount to be paid to programmer
	commissionAmount: real('commission_amount').notNull().default(0), // Studio commission
	totalAmount: real('total_amount').notNull(), // Total amount customer pays
	commissionSettingId: text('commission_setting_id').references(() => commissionSettings.id),
	createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).notNull()
});

// User payment details (programmers can save their payment details for reuse)
export const userPaymentDetails = pgTable('user_payment_details', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	paymentMethodId: text('payment_method_id').notNull().references(() => paymentMethods.id, { onDelete: 'cascade' }),
	details: text('details').notNull(),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).notNull()
});

// Order-specific temporary permissions (for delegating chat access, etc.)
export const orderPermissions = pgTable('order_permissions', {
	id: text('id').primaryKey(),
	orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	permission: orderPermissionEnum('permission').notNull(),
	grantedById: text('granted_by_id').notNull().references(() => users.id),
	expiresAt: timestamp('expires_at', { mode: 'date' }), // null means no expiration (until order is completed)
	createdAt: timestamp('created_at', { mode: 'date' }).notNull()
});

// Types
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