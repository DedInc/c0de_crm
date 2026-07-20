<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { trpc } from '$lib/trpc/client';
	import { onMount } from 'svelte';

	interface PaymentMethod {
		id: string;
		name: string;
	}

	interface Props {
		open: boolean;
		orderId: string;
		orderCost: number;
		onClose: () => void;
		onSuccess: () => void;
	}

	let { open = $bindable(), orderId, orderCost, onClose, onSuccess }: Props = $props();

	let paymentMethods = $state<PaymentMethod[]>([]);
	let selectedMethodId = $state<string | undefined>(undefined);
	let selectedMethodName = $state('');
	let paymentDetails = $state('');
	let programmerAmount = $state(0);
	let commissionAmount = $state(0);
	let totalAmount = $state(0);
	let loading = $state(false);
	let error = $state('');
	let loadingMethods = $state(true);

	onMount(async () => {
		await loadPaymentMethods();
	});

	// Reset form when dialog opens
	 
	$effect(() => {
		if (open) {
			selectedMethodId = undefined;
			selectedMethodName = '';
			paymentDetails = '';
			programmerAmount = orderCost;
			commissionAmount = 0;
			totalAmount = orderCost;
			error = '';
		}
	});

	// Update method name when selection changes
	$effect(() => {
		if (selectedMethodId) {
			const method = paymentMethods.find(m => m.id === selectedMethodId);
			if (method) {
				selectedMethodName = method.name;
			}
		}
	});

	// Auto-calculate total when amounts change
	$effect(() => {
		totalAmount = programmerAmount + commissionAmount;
	});

	async function loadPaymentMethods() {
		try {
			loadingMethods = true;
			paymentMethods = await trpc.orderPayment.getPaymentMethods.query();
		} catch (e) {
			console.error('Failed to load payment methods:', e);
		} finally {
			loadingMethods = false;
		}
	}

	async function handleSubmit() {
		if (!selectedMethodName.trim()) {
			error = $t('orderPayment.methodRequired');
			return;
		}
		if (!paymentDetails.trim()) {
			error = $t('orderPayment.detailsRequired');
			return;
		}
		if (programmerAmount <= 0) {
			error = $t('orderPayment.amountRequired');
			return;
		}

		loading = true;
		error = '';

		try {
			await trpc.orderPayment.sendPaymentInfo.mutate({
				orderId,
				paymentMethodId: selectedMethodId || undefined,
				paymentMethodName: selectedMethodName,
				paymentDetails,
				programmerAmount,
				commissionAmount,
				totalAmount
			});
			onSuccess();
			handleClose();
		} catch (e) {
			error = (e as Error).message || $t('common.error');
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		open = false;
		onClose();
	}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>{$t('orderPayment.sendPaymentInfo')}</Dialog.Title>
			<Dialog.Description>{$t('orderPayment.sendPaymentInfoDescription')}</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
			{#if error}
				<div class="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
			{/if}

			<div class="space-y-2">
				<Label for="paymentMethod">{$t('orderPayment.paymentMethod')}</Label>
				{#if loadingMethods}
					<div class="text-sm text-muted-foreground">{$t('common.loading')}</div>
				{:else}
					<Select.Root type="single" bind:value={selectedMethodId}>
						<Select.Trigger class="w-full">
							<span>{selectedMethodName || $t('orderPayment.selectMethod')}</span>
						</Select.Trigger>
						<Select.Content>
							{#each paymentMethods as method}
								<Select.Item value={method.id}>{method.name}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<p class="text-xs text-muted-foreground">{$t('orderPayment.methodHint')}</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label for="customMethodName">{$t('orderPayment.methodName')}</Label>
				<Input
					id="customMethodName"
					bind:value={selectedMethodName}
					placeholder={$t('orderPayment.methodNamePlaceholder')}
				/>
			</div>

			<div class="space-y-2">
				<Label for="paymentDetails">{$t('orderPayment.paymentDetails')}</Label>
				<Textarea
					id="paymentDetails"
					bind:value={paymentDetails}
					placeholder={$t('orderPayment.paymentDetailsPlaceholder')}
					rows={4}
				/>
				<p class="text-xs text-muted-foreground">{$t('orderPayment.paymentDetailsHint')}</p>
			</div>

			<div class="grid grid-cols-3 gap-4">
				<div class="space-y-2">
					<Label for="programmerAmount">{$t('orderPayment.programmerAmount')}</Label>
					<Input
						id="programmerAmount"
						type="number"
						bind:value={programmerAmount}
						min={0}
						step={0.01}
					/>
				</div>
				<div class="space-y-2">
					<Label for="commissionAmount">{$t('orderPayment.commissionAmount')}</Label>
					<Input
						id="commissionAmount"
						type="number"
						bind:value={commissionAmount}
						min={0}
						step={0.01}
					/>
				</div>
				<div class="space-y-2">
					<Label for="totalAmount">{$t('orderPayment.totalAmount')}</Label>
					<Input
						id="totalAmount"
						type="number"
						bind:value={totalAmount}
						min={0}
						step={0.01}
						readonly
						class="bg-muted"
					/>
				</div>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={handleClose}>
					{$t('common.cancel')}
				</Button>
				<Button type="submit" disabled={loading}>
					{loading ? $t('common.loading') : $t('orderPayment.send')}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>