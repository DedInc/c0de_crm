<script lang="ts">
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Label } from '$lib/components/ui/label';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Props {
		open: boolean;
		responsePrice: number;
		responseMessage: string;
		submitting: boolean;
		maxBudget: number;
		onSubmit: () => void;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		responsePrice = $bindable(),
		responseMessage = $bindable(),
		submitting,
		maxBudget,
		onSubmit,
		onClose
	}: Props = $props();

	// If maxBudget is 0, allow any price (customer doesn't know their budget)
	let priceError = $derived(
		maxBudget > 0 && responsePrice > maxBudget
			? $t('orders.priceExceedsBudget', { budget: maxBudget })
			: ''
	);

	function handleSubmit() {
		if (maxBudget > 0 && responsePrice > maxBudget) return;
		onSubmit();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{$t('orders.respond')}</Dialog.Title>
			<Dialog.Description>
				{$t('orders.submitResponse')}
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4 py-4">
			<div class="space-y-2">
				<Label for="price">{$t('orders.proposedPrice')} ($)</Label>
				<Input
					id="price"
					type="number"
					min="0"
					max={maxBudget > 0 ? maxBudget : undefined}
					step="0.01"
					bind:value={responsePrice}
					class={priceError ? 'border-destructive' : ''}
				/>
				{#if priceError}
					<p class="text-sm text-destructive">{priceError}</p>
				{:else if maxBudget > 0}
					<p class="text-sm text-muted-foreground">
						{$t('orders.maxBudget')}: ${maxBudget}
					</p>
				{:else}
					<p class="text-sm text-muted-foreground">
						{$t('orders.noBudgetLimit')}
					</p>
				{/if}
			</div>
			<div class="space-y-2">
				<Label for="message">{$t('orders.yourMessage')}</Label>
				<Textarea
					id="message"
					bind:value={responseMessage}
					placeholder={$t('orders.yourMessage')}
					rows={4}
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>
				{$t('common.cancel')}
			</Button>
			<Button onclick={handleSubmit} disabled={submitting || !!priceError}>
				{$t('orders.submitResponse')}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>