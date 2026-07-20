import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from '../router';
import type { Context } from '../context';
import type { AuthUser } from '$lib/server/auth';

const mocks = vi.hoisted(() => {
	const state = {
		selectRows: [] as unknown[][]
	};

	const insertValues = vi.fn(() => Promise.resolve());
	const updateWhere = vi.fn(() => Promise.resolve());
	const updateSet = vi.fn(() => ({ where: updateWhere }));
	const deleteWhere = vi.fn(() => Promise.resolve());
	const insert = vi.fn(() => ({ values: insertValues }));
	const update = vi.fn(() => ({ set: updateSet }));
	const deleteFn = vi.fn(() => ({ where: deleteWhere }));

	function select() {
		const rows = state.selectRows.shift() ?? [];
		const chain = {
			from: vi.fn(() => chain),
			where: vi.fn(() => chain),
			innerJoin: vi.fn(() => chain),
			leftJoin: vi.fn(() => chain),
			orderBy: vi.fn(() => Promise.resolve(rows)),
			limit: vi.fn(() => Promise.resolve(rows)),
			groupBy: vi.fn(() => Promise.resolve(rows)),
			offset: vi.fn(() => Promise.resolve(rows)),
			then: (resolve: (rows: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
				Promise.resolve(rows).then(resolve, reject)
		};
		return chain;
	}

	const tx = { insert, update, delete: deleteFn };
	const db = {
		select: vi.fn(select),
		selectDistinct: vi.fn(select),
		insert,
		update,
		delete: deleteFn,
		transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(tx))
	};

	return {
		state,
		db,
		insertValues,
		updateWhere,
		updateSet,
		deleteWhere,
		insert,
		update,
		deleteFn,
		logAudit: vi.fn(() => Promise.resolve()),
		notifyNewMessage: vi.fn(),
		notifyModeratorsAboutNewOrder: vi.fn(() => Promise.resolve()),
		sendMessageToBot: vi.fn(() => Promise.resolve()),
		isR2Configured: vi.fn(() => false),
		deleteFilesByPrefix: vi.fn(() => Promise.resolve(0)),
		hasOrderChatPermission: vi.fn(() => Promise.resolve(false)),
		isInternalApiKeyConfigured: vi.fn(() => true),
		validateInternalApiKey: vi.fn((key: string | null | undefined) => key === 'internal-secret')
	};
});

vi.mock('$lib/server/db', () => ({
	db: mocks.db
}));

vi.mock('$lib/server/audit', () => ({
	logAudit: mocks.logAudit
}));

vi.mock('$lib/server/sse/chat-connections', () => ({
	notifyNewMessage: mocks.notifyNewMessage
}));

vi.mock('$lib/server/internal-auth', () => ({
	isInternalApiKeyConfigured: mocks.isInternalApiKeyConfigured,
	validateInternalApiKey: mocks.validateInternalApiKey
}));

vi.mock('$lib/server/permissions/orders', () => ({
	hasOrderChatPermission: mocks.hasOrderChatPermission
}));

vi.mock('$lib/server/trpc/routers/bot/webhook-helpers', () => ({
	sendMessageToBot: mocks.sendMessageToBot,
	notifyBot: vi.fn(() => Promise.resolve(true)),
	notifyStaff: vi.fn(() => Promise.resolve(true))
}));

vi.mock('$lib/server/r2', () => ({
	isR2Configured: mocks.isR2Configured,
	deleteFilesByPrefix: mocks.deleteFilesByPrefix,
	getPresignedUrl: vi.fn(() => Promise.resolve('https://signed.example/file'))
}));

function userWith(permissions: string[], roles: string[] = []): AuthUser {
	return {
		id: 'user-1',
		username: 'operator',
		telegramId: null,
		permissions,
		roles,
		mustChangePassword: false
	};
}

function context(user: AuthUser | null, internalApiKey: string | null = null): Context {
	return {
		user,
		sessionId: user ? 'session-1' : null,
		internalApiKey,
		clientIp: '127.0.0.1',
		isSecureRequest: false,
		requestId: 'test-request',
		cookies: {} as Context['cookies']
	};
}

function internalContext(): Context {
	return context(null, 'internal-secret');
}

function queueSelect(rows: unknown[]): void {
	mocks.state.selectRows.push(rows);
}

describe('orders mutation authorization', () => {
	beforeEach(() => {
		mocks.state.selectRows.length = 0;
		vi.clearAllMocks();
	});

	it('rejects anonymous order mutations', async () => {
		const caller = appRouter.createCaller(context(null));

		await expect(caller.orders.approve({ id: 'order-1' })).rejects.toMatchObject({
			code: 'UNAUTHORIZED'
		});
	});

	it('rejects users without the required order permission', async () => {
		const caller = appRouter.createCaller(context(userWith([])));

		await expect(caller.orders.approve({ id: 'order-1' })).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
	});

	it('validates mutation input before touching the database', async () => {
		const caller = appRouter.createCaller(context(userWith(['moderate_orders'])));

		await expect(caller.orders.approve({} as { id: string })).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
		expect(mocks.db.select).not.toHaveBeenCalled();
	});

	it('prevents revoking a permission from the wrong order', async () => {
		queueSelect([{ id: 'permission-1', orderId: 'order-2' }]);
		const caller = appRouter.createCaller(context(userWith(['assign_orders'])));

		await expect(
			caller.orders.revokeOrderPermission({ permissionId: 'permission-1', orderId: 'order-1' })
		).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
		expect(mocks.deleteFn).not.toHaveBeenCalled();
	});
});

describe('order-payment mutation authorization', () => {
	beforeEach(() => {
		mocks.state.selectRows.length = 0;
		vi.clearAllMocks();
	});

	it('rejects anonymous payment mutations', async () => {
		const caller = appRouter.createCaller(context(null));

		await expect(
			caller.orderPayment.sendPaymentInfo({
				orderId: 'order-1',
				paymentMethodName: 'Card',
				paymentDetails: 'Invoice',
				programmerAmount: 10,
				totalAmount: 10
			})
		).rejects.toMatchObject({
			code: 'UNAUTHORIZED'
		});
	});

	it('rejects users without payment permission', async () => {
		const caller = appRouter.createCaller(context(userWith([])));

		await expect(
			caller.orderPayment.sendPaymentInfo({
				orderId: 'order-1',
				paymentMethodName: 'Card',
				paymentDetails: 'Invoice',
				programmerAmount: 10,
				totalAmount: 10
			})
		).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
	});

	it('validates payment amounts', async () => {
		const caller = appRouter.createCaller(context(userWith(['send_payment_info'])));

		await expect(
			caller.orderPayment.sendPaymentInfo({
				orderId: 'order-1',
				paymentMethodName: 'Card',
				paymentDetails: 'Invoice',
				programmerAmount: -1,
				totalAmount: 10
			})
		).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
		expect(mocks.db.select).not.toHaveBeenCalled();
	});

	it('prevents non-owners from updating payment records', async () => {
		queueSelect([{ id: 'payment-1', providedByUserId: 'other-user' }]);
		const caller = appRouter.createCaller(context(userWith(['send_payment_info'])));

		await expect(
			caller.orderPayment.updatePaymentInfo({ id: 'payment-1', paymentDetails: 'Updated' })
		).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it('creates payment info for allowed order statuses', async () => {
		queueSelect([{
			id: 'order-1',
			status: 'in_progress',
			assignedToId: null,
			customerTelegramId: '1234567',
			title: 'Landing page'
		}]);
		const caller = appRouter.createCaller(context(userWith(['send_payment_info'])));

		await expect(
			caller.orderPayment.sendPaymentInfo({
				orderId: 'order-1',
				paymentMethodName: 'Card',
				paymentDetails: 'Invoice #1',
				programmerAmount: 10,
				commissionAmount: 2,
				totalAmount: 12
			})
		).resolves.toEqual({ id: expect.any(String) });
		expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
			orderId: 'order-1',
			providedByUserId: 'user-1',
			paymentMethodName: 'Card'
		}));
	});
});

describe('users mutation authorization', () => {
	beforeEach(() => {
		mocks.state.selectRows.length = 0;
		vi.clearAllMocks();
	});

	it('rejects anonymous user mutations', async () => {
		const caller = appRouter.createCaller(context(null));

		await expect(
			caller.users.create({ username: 'new-user', password: 'secret1', roleIds: [] })
		).rejects.toMatchObject({
			code: 'UNAUTHORIZED'
		});
	});

	it('rejects users without manage_users permission', async () => {
		const caller = appRouter.createCaller(context(userWith([])));

		await expect(
			caller.users.create({ username: 'new-user', password: 'secret1', roleIds: [] })
		).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
	});

	it('validates Telegram IDs before user creation', async () => {
		const caller = appRouter.createCaller(context(userWith(['manage_users'])));

		await expect(
			caller.users.create({
				username: 'new-user',
				password: 'secret1',
				roleIds: [],
				telegramId: 'not-a-number'
			})
		).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
		expect(mocks.db.select).not.toHaveBeenCalled();
	});

	it('creates users inside a transaction', async () => {
		queueSelect([]);
		const caller = appRouter.createCaller(context(userWith(['manage_users'])));

		await expect(
			caller.users.create({
				username: 'new-user',
				password: 'secret1',
				roleIds: ['role-1'],
				markerIds: ['marker-1']
			})
		).resolves.toEqual({ id: expect.any(String) });
		expect(mocks.db.transaction).toHaveBeenCalledOnce();
		expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
			username: 'new-user',
			mustChangePassword: true
		}));
		expect(mocks.insertValues).toHaveBeenCalledWith({ userId: expect.any(String), roleId: 'role-1' });
		expect(mocks.insertValues).toHaveBeenCalledWith({ userId: expect.any(String), markerId: 'marker-1' });
	});

	it('prevents linking a Telegram ID already claimed by another user', async () => {
		queueSelect([{ id: 'other-user' }]);
		const caller = appRouter.createCaller(context(userWith([])));

		await expect(
			caller.users.updateOwnTelegramId({ telegramId: '1234567' })
		).rejects.toMatchObject({
			code: 'CONFLICT'
		});
	});
});

describe('chat router regression coverage', () => {
	beforeEach(() => {
		mocks.state.selectRows.length = 0;
		vi.clearAllMocks();
	});

	it('rejects empty staff chat messages before database access', async () => {
		const caller = appRouter.createCaller(context(userWith(['chat_customers'])));

		await expect(
			caller.chat.sendMessage({ orderId: 'order-1', message: '' })
		).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
		expect(mocks.db.select).not.toHaveBeenCalled();
	});

	it('rejects cross-order R2 attachments before database access', async () => {
		const caller = appRouter.createCaller(context(userWith(['chat_customers'])));

		await expect(
			caller.chat.sendMessage({
				orderId: 'order-1',
				message: 'See attached',
				fileUrls: [{ url: 'r2:chat/order-2/file.pdf', name: 'file.pdf', type: 'application/pdf' }]
			})
		).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
		expect(mocks.db.select).not.toHaveBeenCalled();
	});
});

describe('admin and catalog router authorization', () => {
	beforeEach(() => {
		mocks.state.selectRows.length = 0;
		vi.clearAllMocks();
	});

	it('protects role and permission lists with manage_roles', async () => {
		await expect(appRouter.createCaller(context(null)).roles.list()).rejects.toMatchObject({
			code: 'UNAUTHORIZED'
		});

		const unauthorizedCaller = appRouter.createCaller(context(userWith([])));
		await expect(unauthorizedCaller.roles.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(unauthorizedCaller.permissions.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
	});

	it('protects marker mutations and validates marker color before database access', async () => {
		await expect(appRouter.createCaller(context(null)).markers.list()).rejects.toMatchObject({
			code: 'UNAUTHORIZED'
		});

		const unauthorizedCaller = appRouter.createCaller(context(userWith([])));
		await expect(
			unauthorizedCaller.markers.create({ name: 'Svelte', color: '#ff3e00' })
		).rejects.toMatchObject({ code: 'FORBIDDEN' });

		const managerCaller = appRouter.createCaller(context(userWith(['manage_markers'])));
		await expect(
			managerCaller.markers.create({ name: 'Svelte', color: 'orange' })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect(mocks.db.select).not.toHaveBeenCalled();
	});

	it('protects payment method administration while keeping active methods authenticated', async () => {
		const caller = appRouter.createCaller(context(userWith([])));

		await expect(caller.paymentMethods.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
		await expect(appRouter.createCaller(context(null)).paymentMethods.listActive()).rejects.toMatchObject({
			code: 'UNAUTHORIZED'
		});
	});

	it('protects audit logs and validates audit pagination bounds', async () => {
		const caller = appRouter.createCaller(context(userWith([])));

		await expect(caller.audit.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });

		const adminCaller = appRouter.createCaller(context(userWith([], ['Administrator'])));
		await expect(adminCaller.audit.list({ perPage: 5 })).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
		expect(mocks.db.select).not.toHaveBeenCalled();
	});

	it('protects currency administration and validates currency input before fetch/database access', async () => {
		await expect(appRouter.createCaller(context(null)).currency.list()).rejects.toMatchObject({
			code: 'UNAUTHORIZED'
		});

		const caller = appRouter.createCaller(context(userWith([])));
		await expect(caller.currency.add({ code: 'USD', symbol: '$' })).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});

		const adminCaller = appRouter.createCaller(context(userWith([], ['Administrator'])));
		await expect(adminCaller.currency.add({ code: '', symbol: '$' })).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
		expect(mocks.db.select).not.toHaveBeenCalled();
	});

	it('converts RUB targets through Frankfurter USD/RUB data', async () => {
		const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
			const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

			if (url === 'https://api.frankfurter.dev/v2/rate/USD/RUB') {
				return new Response(JSON.stringify({ date: '2026-04-30', base: 'USD', quote: 'RUB', rate: 75.063 }));
			}

			if (url === 'https://min-api.cryptocompare.com/data/price?fsym=EUR&tsyms=USD') {
				return new Response(JSON.stringify({ USD: 1.08 }));
			}

			throw new Error(`Unexpected fetch URL: ${url}`);
		});
		vi.stubGlobal('fetch', fetchMock);

		try {
			const caller = appRouter.createCaller(context(userWith(['view_orders'])));
			const result = await caller.currency.convert({ amount: 2, from: 'EUR', to: 'RUB' });

			expect(result.rate).toBeCloseTo(81.06804, 5);
			expect(result.converted).toBeCloseTo(162.13608, 5);
			expect(fetchMock).toHaveBeenCalledWith('https://api.frankfurter.dev/v2/rate/USD/RUB');
			expect(fetchMock).toHaveBeenCalledWith('https://min-api.cryptocompare.com/data/price?fsym=EUR&tsyms=USD');
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('bot router internal authentication', () => {
	beforeEach(() => {
		mocks.state.selectRows.length = 0;
		vi.clearAllMocks();
		mocks.isInternalApiKeyConfigured.mockReturnValue(true);
		mocks.validateInternalApiKey.mockImplementation((key) => key === 'internal-secret');
	});

	it('rejects bot calls without the internal API key', async () => {
		const caller = appRouter.createCaller(context(null));

		await expect(caller.bot.getMarkers()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
	});

	it('rejects bot calls when the internal key is not configured', async () => {
		mocks.isInternalApiKeyConfigured.mockReturnValueOnce(false);
		const caller = appRouter.createCaller(internalContext());

		await expect(caller.bot.getMarkers()).rejects.toMatchObject({
			code: 'INTERNAL_SERVER_ERROR'
		});
	});

	it('returns active markers to authenticated bot callers', async () => {
		queueSelect([
			{ id: 'marker-1', name: 'Svelte', color: '#ff3e00', createdAt: new Date() }
		]);

		const caller = appRouter.createCaller(internalContext());
		const result = await caller.bot.getMarkers();

		expect(result).toEqual([
			expect.objectContaining({ id: 'marker-1', name: 'Svelte' })
		]);
	});

	it('upserts a Telegram user language preference', async () => {
		queueSelect([]);
		const caller = appRouter.createCaller(internalContext());

		await expect(caller.bot.setUserLanguage({ telegramId: '777', language: 'ru' })).resolves.toEqual({
			success: true
		});
		expect(mocks.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ telegramId: '777', language: 'ru' })
		);
	});

	it('rejects creating an order when the customer has reached the open-order limit', async () => {
		queueSelect([{ id: 'order-1' }, { id: 'order-2' }]);
		const caller = appRouter.createCaller(internalContext());

		await expect(
			caller.bot.createOrder({
				title: 'Landing',
				description: 'Need a homepage',
				cost: 500,
				customerTelegramId: '555'
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect(mocks.insertValues).not.toHaveBeenCalled();
	});

	it('creates a new order through the bot pathway', async () => {
		queueSelect([]);
		const caller = appRouter.createCaller(internalContext());

		const result = await caller.bot.createOrder({
			title: 'Mobile UI',
			description: 'New mobile screens',
			cost: 1200,
			customerTelegramId: '555',
			markerIds: ['marker-1']
		});

		expect(result).toEqual({ id: expect.any(String) });
		expect(mocks.db.transaction).toHaveBeenCalledOnce();
		expect(mocks.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Mobile UI',
				customerTelegramId: '555',
				status: 'pending_moderation'
			})
		);
		expect(mocks.insertValues).toHaveBeenCalledWith({
			orderId: expect.any(String),
			markerId: 'marker-1'
		});
	});

	it('prevents customers from deleting orders that are not theirs', async () => {
		queueSelect([{ id: 'order-1', customerTelegramId: '999', status: 'pending_moderation' }]);
		const caller = appRouter.createCaller(internalContext());

		await expect(
			caller.bot.deleteOrder({ orderId: 'order-1', customerTelegramId: '555' })
		).rejects.toMatchObject({ code: 'FORBIDDEN' });
		expect(mocks.deleteFn).not.toHaveBeenCalled();
	});

	it('rejects deletion of orders past pending_moderation/rejected', async () => {
		queueSelect([{ id: 'order-1', customerTelegramId: '555', status: 'in_progress' }]);
		const caller = appRouter.createCaller(internalContext());

		await expect(
			caller.bot.deleteOrder({ orderId: 'order-1', customerTelegramId: '555' })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect(mocks.deleteFn).not.toHaveBeenCalled();
	});

	it('records a customer-originated chat message via the bot transport', async () => {
		queueSelect([
			{ id: 'order-1', customerTelegramId: '555', status: 'in_progress' }
		]);
		const caller = appRouter.createCaller(internalContext());

		const result = await caller.bot.sendCustomerMessage({
			orderId: 'order-1',
			customerTelegramId: '555',
			message: 'Hello'
		});

		expect(result).toEqual({ id: expect.any(String) });
		expect(mocks.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: 'order-1', senderType: 'customer' })
		);
		expect(mocks.notifyNewMessage).toHaveBeenCalledWith(
			'order-1',
			expect.objectContaining({ type: 'new_message' })
		);
	});

	it('refuses bot-side message delivery when the body is empty and no media is attached', async () => {
		const caller = appRouter.createCaller(internalContext());

		await expect(
			caller.bot.sendCustomerMessage({
				orderId: 'order-1',
				customerTelegramId: '555',
				message: ''
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' });
		expect(mocks.insertValues).not.toHaveBeenCalled();
	});
});

describe('chat router happy paths', () => {
	beforeEach(() => {
		mocks.state.selectRows.length = 0;
		vi.clearAllMocks();
		mocks.hasOrderChatPermission.mockResolvedValue(false);
	});

	it('returns chat history when a user has chat_customers permission', async () => {
		queueSelect([
			{
				id: 'msg-1',
				orderId: 'order-1',
				senderId: 'user-1',
				senderType: 'staff',
				message: 'Hello',
				imageUrls: null,
				fileUrls: null,
				createdAt: new Date(),
				senderName: 'operator'
			}
		]);

		const caller = appRouter.createCaller(context(userWith(['chat_customers'])));
		const result = await caller.chat.getMessages({ orderId: 'order-1' });

		expect(result).toEqual([
			expect.objectContaining({ id: 'msg-1', senderType: 'staff' })
		]);
	});

	it('rejects chat history requests for users without chat permission', async () => {
		const caller = appRouter.createCaller(context(userWith([])));

		await expect(caller.chat.getMessages({ orderId: 'order-1' })).rejects.toMatchObject({
			code: 'FORBIDDEN'
		});
		expect(mocks.hasOrderChatPermission).toHaveBeenCalledWith('user-1', 'order-1');
	});

	it('persists a staff message and broadcasts it via SSE', async () => {
		queueSelect([
			{ id: 'order-1', customerTelegramId: '555', title: 'Landing' }
		]);

		const caller = appRouter.createCaller(context(userWith(['chat_customers'])));
		const result = await caller.chat.sendMessage({
			orderId: 'order-1',
			message: 'Following up'
		});

		expect(result).toEqual({ id: expect.any(String) });
		expect(mocks.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: 'order-1', senderType: 'staff' })
		);
		expect(mocks.notifyNewMessage).toHaveBeenCalledWith(
			'order-1',
			expect.objectContaining({
				type: 'new_message',
				message: expect.objectContaining({ senderType: 'staff' })
			})
		);
		expect(mocks.sendMessageToBot).toHaveBeenCalledWith(
			'555',
			'Following up',
			'Landing',
			'order-1',
			undefined,
			undefined
		);
	});

	it('returns chat-permission summary for a specific order', async () => {
		mocks.hasOrderChatPermission.mockResolvedValueOnce(true);
		const caller = appRouter.createCaller(context(userWith([])));

		const result = await caller.chat.canChatForOrder({ orderId: 'order-1' });
		expect(result).toBe(true);
	});
});

describe('order moderation happy paths', () => {
	beforeEach(() => {
		mocks.state.selectRows.length = 0;
		vi.clearAllMocks();
	});

	it('approves a pending order and notifies downstream listeners', async () => {
		queueSelect([
			{ id: 'order-1', status: 'pending_moderation', customerTelegramId: '555', title: 'Landing' }
		]);
		queueSelect([]);
		queueSelect([]);

		const caller = appRouter.createCaller(context(userWith(['moderate_orders'])));

		const result = await caller.orders.approve({ id: 'order-1' });
		expect(result).toEqual({ success: true });
		expect(mocks.update).toHaveBeenCalled();
		expect(mocks.updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'approved' })
		);
	});

	it('rejects a pending order without changing its status when not pending', async () => {
		queueSelect([{ id: 'order-1', status: 'in_progress', customerTelegramId: '555', title: 'Landing' }]);

		const caller = appRouter.createCaller(context(userWith(['moderate_orders'])));

		await expect(caller.orders.reject({ id: 'order-1' })).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
		expect(mocks.update).not.toHaveBeenCalled();
	});
});

describe('roles administration happy paths', () => {
	beforeEach(() => {
		mocks.state.selectRows.length = 0;
		vi.clearAllMocks();
	});

	it('creates a new role with permissions inside a transaction', async () => {
		queueSelect([]);

		const caller = appRouter.createCaller(context(userWith(['manage_roles'])));
		const result = await caller.roles.create({
			name: 'Reviewer',
			permissionIds: ['perm-1', 'perm-2']
		});

		expect(result).toEqual({ id: expect.any(String) });
		expect(mocks.db.transaction).toHaveBeenCalledOnce();
		expect(mocks.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Reviewer' })
		);
		expect(mocks.insertValues).toHaveBeenCalledWith({
			roleId: expect.any(String),
			permissionId: 'perm-1'
		});
	});

	it('blocks deletion of the seeded Administrator role', async () => {
		queueSelect([{ id: 'role-1', name: 'Administrator' }]);

		const caller = appRouter.createCaller(context(userWith(['manage_roles'])));

		await expect(caller.roles.delete({ id: 'role-1' })).rejects.toMatchObject({
			code: 'BAD_REQUEST'
		});
		expect(mocks.deleteFn).not.toHaveBeenCalled();
	});
});
