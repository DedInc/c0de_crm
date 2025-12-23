<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { PaymentMethodFormDialog, DeletePaymentMethodDialog } from '$lib/components/payment-methods';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	interface PaymentMethod {
		id: string;
		name: string;
		details: string;
		isActive: boolean;
		sortOrder: number;
		createdAt: string | Date;
		updatedAt: string | Date;
	}

	let paymentMethods = $state<PaymentMethod[]>([]);
	let loading = $state(true);
	let error = $state('');

	// Form dialog state
	let showFormDialog = $state(false);
	let editingPaymentMethod = $state<PaymentMethod | null>(null);
	let saving = $state(false);

	// Delete dialog state
	let showDeleteDialog = $state(false);
	let deletingPaymentMethod = $state<PaymentMethod | null>(null);
	let deleting = $state(false);

	onMount(async () => {
		await loadPaymentMethods();
	});

	async function loadPaymentMethods() {
		try {
			loading = true;
			paymentMethods = await trpc.paymentMethods.list.query();
		} catch (e) {
			error = (e as Error).message || 'Failed to load payment methods';
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		editingPaymentMethod = null;
		showFormDialog = true;
	}

	function openEditDialog(pm: PaymentMethod) {
		editingPaymentMethod = pm;
		showFormDialog = true;
	}

	function openDeleteDialog(pm: PaymentMethod) {
		deletingPaymentMethod = pm;
		showDeleteDialog = true;
	}

	async function handleSave(data: { name: string; isActive: boolean; sortOrder: number }) {
		saving = true;
		error = '';
		try {
			if (editingPaymentMethod) {
				await trpc.paymentMethods.update.mutate({
					id: editingPaymentMethod.id,
					name: data.name,
					isActive: data.isActive,
					sortOrder: data.sortOrder
				});
			} else {
				await trpc.paymentMethods.create.mutate({
					name: data.name,
					isActive: data.isActive,
					sortOrder: data.sortOrder
				});
			}
			showFormDialog = false;
			await loadPaymentMethods();
		} catch (e) {
			error = (e as Error).message || 'Failed to save payment method';
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!deletingPaymentMethod) return;
		deleting = true;
		error = '';
		try {
			await trpc.paymentMethods.delete.mutate({ id: deletingPaymentMethod.id });
			showDeleteDialog = false;
			deletingPaymentMethod = null;
			await loadPaymentMethods();
		} catch (e) {
			error = (e as Error).message || 'Failed to delete payment method';
		} finally {
			deleting = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">{$t('paymentMethods.title')}</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="h-4 w-4 mr-2" />
			{$t('paymentMethods.newPaymentMethod')}
		</Button>
	</div>

	{#if error}
		<div class="p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>
	{/if}

	<Card.Root>
		<Card.Content class="pt-6">
			{#if loading}
				<div class="flex items-center justify-center py-12">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			{:else if paymentMethods.length === 0}
				<div class="text-center py-12 text-muted-foreground">
					{$t('paymentMethods.noPaymentMethods')}
				</div>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>{$t('paymentMethods.methodName')}</Table.Head>
							<Table.Head>{$t('paymentMethods.status')}</Table.Head>
							<Table.Head>{$t('paymentMethods.sortOrder')}</Table.Head>
							<Table.Head class="text-right">{$t('common.actions')}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each paymentMethods as pm}
							<Table.Row>
								<Table.Cell class="font-medium">{pm.name}</Table.Cell>
								<Table.Cell>
									{#if pm.isActive}
										<Badge variant="default">{$t('paymentMethods.active')}</Badge>
									{:else}
										<Badge variant="secondary">{$t('paymentMethods.inactive')}</Badge>
									{/if}
								</Table.Cell>
								<Table.Cell>{pm.sortOrder}</Table.Cell>
								<Table.Cell class="text-right">
									<div class="flex justify-end gap-2">
										<Button variant="ghost" size="icon" onclick={() => openEditDialog(pm)}>
											<Pencil class="h-4 w-4" />
										</Button>
										<Button variant="ghost" size="icon" onclick={() => openDeleteDialog(pm)}>
											<Trash2 class="h-4 w-4 text-destructive" />
										</Button>
									</div>
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<PaymentMethodFormDialog
	bind:open={showFormDialog}
	paymentMethod={editingPaymentMethod}
	{saving}
	onSave={handleSave}
	onClose={() => { showFormDialog = false; editingPaymentMethod = null; }}
/>

<DeletePaymentMethodDialog
	bind:open={showDeleteDialog}
	paymentMethodName={deletingPaymentMethod?.name || ''}
	{deleting}
	onConfirm={handleDelete}
	onClose={() => { showDeleteDialog = false; deletingPaymentMethod = null; }}
/>