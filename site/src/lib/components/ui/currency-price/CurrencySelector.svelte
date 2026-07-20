<script lang="ts">
	import { displayCurrency, setDisplayCurrency, currencies, loadCurrencies, type CurrencyInfo } from '$lib/stores/currency.svelte';
	import * as Select from '$lib/components/ui/select';
	import { onMount } from 'svelte';

	let currencyList = $state<CurrencyInfo[]>([]);

	onMount(async () => {
		const list = await loadCurrencies();
		currencyList = list;
	});

	// Keep in sync with store
	$effect(() => {
		currencyList = $currencies;
	});

	function handleChange(value: string | undefined) {
		if (value) {
			setDisplayCurrency(value);
		}
	}

	function getSymbol(code: string): string {
		const found = currencyList.find(c => c.code === code);
		return found ? found.symbol : code;
	}
</script>

<Select.Root type="single" value={$displayCurrency} onValueChange={handleChange}>
	<Select.Trigger class="w-[100px]">
		<span>{getSymbol($displayCurrency)} {$displayCurrency}</span>
	</Select.Trigger>
	<Select.Content>
		{#each currencyList as cur}
			<Select.Item value={cur.code}>{cur.symbol} {cur.code}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
