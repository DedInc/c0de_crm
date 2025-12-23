<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';

	interface PaymentMethod {
		id: string;
		name: string;
		details: string;
		isActive: boolean;
		sortOrder: number;
	}

	interface Props {
		open: boolean;
		paymentMethod?: PaymentMethod | null;
		saving: boolean;
		onSave: (data: { name: string; isActive: boolean; sortOrder: number }) => void;
		onClose: () => void;
	}

	let { open = $bindable(), paymentMethod = null, saving, onSave, onClose }: Props = $props();

	let name = $state('');
	let isActive = $state(true);
	let sortOrder = $state(0);
	let error = $state('');

	$effect(() => {
		if (open) {
			if (paymentMethod) {
				name = paymentMethod.name;
				isActive = paymentMethod.isActive;
				sortOrder = paymentMethod.sortOrder;
			} else {
				name = '';
				isActive = true;
				sortOrder = 0;
			}
			error = '';
		}
	});

	function handleSubmit() {
		if (!name.trim()) {
			error = $t('paymentMethods.nameRequired');
			return;
		}
		onSave({ name: name.trim(), isActive, sortOrder });
	}

	function handleClose() {
		open = false;
		onClose();
	}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{paymentMethod ? $t('paymentMethods.editPaymentMethod') : $t('paymentMethods.newPaymentMethod')}
			</Dialog.Title>
			<p class="text-sm text-muted-foreground mt-2">
				{$t('paymentMethods.formDescription')}
			</p>
		</Dialog.Header>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
			{#if error}
				<div class="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
			{/if}

			<div class="space-y-2">
				<Label for="name">{$t('paymentMethods.methodName')}</Label>
				<Input
					id="name"
					bind:value={name}
					placeholder={$t('paymentMethods.methodNamePlaceholder')}
				/>
			</div>

			<div class="space-y-2">
				<Label for="sortOrder">{$t('paymentMethods.sortOrder')}</Label>
				<Input
					id="sortOrder"
					type="number"
					bind:value={sortOrder}
					min={0}
				/>
			</div>

			<div class="flex items-center space-x-2">
				<Checkbox id="isActive" bind:checked={isActive} />
				<Label for="isActive" class="cursor-pointer">{$t('paymentMethods.isActive')}</Label>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={handleClose}>
					{$t('common.cancel')}
				</Button>
				<Button type="submit" disabled={saving}>
					{saving ? $t('common.loading') : $t('common.save')}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>