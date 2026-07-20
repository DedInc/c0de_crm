<script lang="ts">
	import { displayCurrency, convertCurrency, formatPrice } from '$lib/stores/currency.svelte';

	interface Props {
		amount: number;
		currency: string;
		class?: string;
	}

	let { amount, currency, class: className = '' }: Props = $props();

	let convertedAmount = $state<number | null>(null);
	let loading = $state(false);

	$effect(() => {
		const targetCurrency = $displayCurrency;
		if (currency === targetCurrency) {
			convertedAmount = null;
		} else {
			loading = true;
			convertCurrency(amount, currency, targetCurrency).then((result) => {
				convertedAmount = result;
				loading = false;
			});
		}
	});
</script>

<span class={className}>
	<span class="font-bold">{formatPrice(amount, currency)}</span>
	{#if convertedAmount !== null && !loading}
		<span class="text-muted-foreground text-sm ml-1">(≈ {formatPrice(convertedAmount, $displayCurrency)})</span>
	{/if}
</span>
