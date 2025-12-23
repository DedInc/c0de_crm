<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { hasPermission, isAdmin } from '$lib/stores/auth';
	import { Button } from '$lib/components/ui/button';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import {
		ResponseDialog,
		AssignDialog,
		OrderInfo,
		OrderResponses,
		OrderActions,
		OrderPermissionsDialog,
		SendPaymentInfoDialog,
		OrderPaymentInfo
	} from '$lib/components/orders';
	import type { Order, PaymentInfo } from './types';
	import * as api from './api';
	import * as permissions from './permissions';

	let order = $state<Order | null>(null);
	let loading = $state(true);
	let error = $state('');

	// Response form
	let showResponseDialog = $state(false);
	let responsePrice = $state(0);
	let responseMessage = $state('');
	let submittingResponse = $state(false);

	// Assign form
	let showAssignDialog = $state(false);
	let selectedUserId = $state('');
	let users = $state<{ id: string; username: string }[]>([]);
	let assigningOrder = $state(false);

	// Status update
	let updatingStatus = $state(false);

	// Permissions dialog
	let showPermissionsDialog = $state(false);

	// Chat access for assigned programmer
	let canChatForOrder = $state(false);

	// Payment info
	let showPaymentInfoDialog = $state(false);
	let paymentInfoList = $state<PaymentInfo[]>([]);
	let canSendPayment = $state(false);

	const orderId = $page.params.id ?? '';

	onMount(async () => {
		await loadOrderData();
		await checkAccess();
	});

	$effect(() => {
		if (order && (hasPermission('assign_orders') || isAdmin())) {
			users = api.loadUsersFromResponses(order);
		}
	});

	async function loadOrderData() {
		try {
			order = await api.loadOrder(orderId);
			responsePrice = order?.cost || 0;
		} catch (e: unknown) {
			error = (e as Error).message || 'Failed to load order';
		} finally {
			loading = false;
		}
	}

	async function checkAccess() {
		try {
			canChatForOrder = await api.checkChatAccess(orderId);
			paymentInfoList = await api.loadPaymentInfo(orderId);
			canSendPayment = await api.checkPaymentPermission(orderId);
		} catch {
			canChatForOrder = false;
		}
	}

	async function handleApprove() {
		if (!order) return;
		try {
			await api.approveOrder(order.id);
			await loadOrderData();
		} catch (e: unknown) {
			error = (e as Error).message;
		}
	}

	async function handleReject() {
		if (!order) return;
		try {
			await api.rejectOrder(order.id);
			await loadOrderData();
		} catch (e: unknown) {
			error = (e as Error).message;
		}
	}

	async function handleSubmitResponse() {
		if (!order) return;
		submittingResponse = true;
		try {
			await api.submitResponse(order.id, responsePrice, responseMessage || undefined);
			showResponseDialog = false;
			responseMessage = '';
			await loadOrderData();
		} catch (e: unknown) {
			error = (e as Error).message;
		} finally {
			submittingResponse = false;
		}
	}

	async function handleAssign() {
		if (!order || !selectedUserId) return;
		assigningOrder = true;
		try {
			await api.assignOrder(order.id, selectedUserId);
			showAssignDialog = false;
			await loadOrderData();
		} catch (e: unknown) {
			error = (e as Error).message;
		} finally {
			assigningOrder = false;
		}
	}

	async function handleStatusUpdate(newStatus: string) {
		if (!order) return;
		updatingStatus = true;
		try {
			await api.updateOrderStatus(order.id, newStatus);
			await loadOrderData();
		} catch (e: unknown) {
			error = (e as Error).message;
		} finally {
			updatingStatus = false;
		}
	}

	async function handlePaymentInfoSent() {
		paymentInfoList = await api.loadPaymentInfo(orderId);
	}
</script>

<div class="space-y-6">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" onclick={() => goto('/orders')}>
			<ArrowLeft class="h-5 w-5" />
		</Button>
		<h1 class="text-3xl font-bold">{$t('orders.orderDetails')}</h1>
	</div>

	{#if error}
		<div class="p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>
	{/if}

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else if order}
		<div class="grid gap-6 lg:grid-cols-3">
			<div class="lg:col-span-2 space-y-6">
				<OrderInfo {order} />
				<OrderPaymentInfo {paymentInfoList} />
				<OrderResponses responses={order.responses} />
			</div>

			<div class="space-y-6">
				<OrderActions
					orderId={order.id}
					canModerate={permissions.canModerate(order, hasPermission('moderate_orders'), isAdmin())}
					canRespond={permissions.canRespond(order)}
					canAssign={permissions.canAssign(order, hasPermission('assign_orders'), isAdmin())}
					canUpdateStatus={permissions.canUpdateStatus(order, hasPermission('update_order_status'), isAdmin())}
					canManagePermissions={permissions.canManagePermissions(hasPermission('assign_orders'), isAdmin())}
					canChat={canChatForOrder}
					{canSendPayment}
					nextStatuses={permissions.getNextStatuses(order, hasPermission('update_order_status'), isAdmin())}
					{updatingStatus}
					onApprove={handleApprove}
					onReject={handleReject}
					onOpenResponse={() => (showResponseDialog = true)}
					onOpenAssign={() => (showAssignDialog = true)}
					onStatusUpdate={handleStatusUpdate}
					onOpenPermissions={() => (showPermissionsDialog = true)}
					onOpenPaymentInfo={() => (showPaymentInfoDialog = true)}
				/>
			</div>
		</div>
	{/if}
</div>

<ResponseDialog
	bind:open={showResponseDialog}
	bind:responsePrice
	bind:responseMessage
	submitting={submittingResponse}
	maxBudget={order?.cost || 0}
	onSubmit={handleSubmitResponse}
	onClose={() => (showResponseDialog = false)}
/>

<AssignDialog
	bind:open={showAssignDialog}
	bind:selectedUserId
	{users}
	assigning={assigningOrder}
	onAssign={handleAssign}
	onClose={() => (showAssignDialog = false)}
/>

{#if order}
	<OrderPermissionsDialog
		bind:open={showPermissionsDialog}
		orderId={order.id}
		assignedUserId={order.assignedTo?.id}
		onClose={() => (showPermissionsDialog = false)}
	/>

	<SendPaymentInfoDialog
		bind:open={showPaymentInfoDialog}
		orderId={order.id}
		orderCost={order.cost}
		onClose={() => (showPaymentInfoDialog = false)}
		onSuccess={handlePaymentInfoSent}
	/>
{/if}