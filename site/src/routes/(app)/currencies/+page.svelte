<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import { loadCurrencies } from '$lib/stores/currency.svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Loader2 from '@lucide/svelte/icons/loader-2';

	interface Currency {
		id: string;
		code: string;
		symbol: string;
		isDefault: boolean;
	}

	let currencies = $state<Currency[]>([]);
	let loading = $state(true);
	let error = $state('');
	let successMsg = $state('');

	// Add form state
	let newCode = $state('');
	let newSymbol = $state('');
	let adding = $state(false);
	let validating = $state(false);
	let validationResult = $state<{ valid: boolean; checked: boolean }>({ valid: false, checked: false });

	onMount(async () => {
		await loadCurrencyList();
	});

	async function loadCurrencyList() {
		try {
			loading = true;
			error = '';
			currencies = await trpc.currency.list.query();
		} catch (e) {
			error = (e as Error).message || 'Failed to load currencies';
		} finally {
			loading = false;
		}
	}

	async function validateCode() {
		const code = newCode.trim().toUpperCase();
		if (!code) return;
		validating = true;
		validationResult = { valid: false, checked: false };
		try {
			const result = await trpc.currency.validate.query({ code });
			validationResult = { valid: result.valid, checked: true };
		} catch {
			validationResult = { valid: false, checked: true };
		} finally {
			validating = false;
		}
	}

	async function handleAdd() {
		const code = newCode.trim().toUpperCase();
		const symbol = newSymbol.trim();
		if (!code || !symbol) {
			error = $t('currencies.codeAndSymbolRequired');
			return;
		}
		adding = true;
		error = '';
		successMsg = '';
		try {
			await trpc.currency.add.mutate({ code, symbol });
			newCode = '';
			newSymbol = '';
			validationResult = { valid: false, checked: false };
			successMsg = $t('currencies.addedSuccessfully').replace('{code}', code);
			await loadCurrencyList();
			// Reload global currency list
			await loadCurrencies();
		} catch (e) {
			error = (e as Error).message || 'Failed to add currency';
		} finally {
			adding = false;
		}
	}

	async function handleDelete(currency: Currency) {
		error = '';
		successMsg = '';
		try {
			await trpc.currency.remove.mutate({ id: currency.id });
			successMsg = $t('currencies.deletedSuccessfully').replace('{code}', currency.code);
			await loadCurrencyList();
			await loadCurrencies();
		} catch (e) {
			error = (e as Error).message || 'Failed to delete currency';
		}
	}

	// Auto-validate when code changes (debounced)
	let validateTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const code = newCode.trim();
		validationResult = { valid: false, checked: false };
		if (validateTimer) clearTimeout(validateTimer);
		if (code.length >= 2) {
			validateTimer = setTimeout(() => validateCode(), 500);
		}
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">{$t('currencies.title')}</h1>
	</div>

	{#if error}
		<div class="p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>
	{/if}

	{#if successMsg}
		<div class="p-4 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md">{successMsg}</div>
	{/if}

	<!-- Add Currency Form -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{$t('currencies.addCurrency')}</Card.Title>
			<Card.Description>{$t('currencies.addDescription')}</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex items-end gap-4">
				<div class="flex-1 max-w-[200px]">
					<label for="currency-code" class="text-sm font-medium mb-1 block">{$t('currencies.code')}</label>
					<div class="relative">
						<Input
							id="currency-code"
							bind:value={newCode}
							placeholder="e.g., JPY, TRY, SOL"
							class="uppercase"
						/>
						{#if validating}
							<div class="absolute right-2 top-1/2 -translate-y-1/2">
								<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
							</div>
						{:else if validationResult.checked}
							<div class="absolute right-2 top-1/2 -translate-y-1/2">
								{#if validationResult.valid}
									<Check class="h-4 w-4 text-green-500" />
								{:else}
									<X class="h-4 w-4 text-destructive" />
								{/if}
							</div>
						{/if}
					</div>
					{#if validationResult.checked && !validationResult.valid && newCode.trim().length >= 2}
						<p class="text-xs text-destructive mt-1">{$t('currencies.invalidCode')}</p>
					{:else if validationResult.checked && validationResult.valid}
						<p class="text-xs text-green-600 dark:text-green-400 mt-1">{$t('currencies.validCode')}</p>
					{/if}
				</div>
				<div class="flex-1 max-w-[120px]">
					<label for="currency-symbol" class="text-sm font-medium mb-1 block">{$t('currencies.symbol')}</label>
					<Input
						id="currency-symbol"
						bind:value={newSymbol}
						placeholder="e.g., ¥, ₺, ◎"
					/>
				</div>
				<Button
					onclick={handleAdd}
					disabled={adding || !validationResult.valid || !newSymbol.trim()}
				>
					{#if adding}
						<Loader2 class="h-4 w-4 mr-2 animate-spin" />
					{:else}
						<Plus class="h-4 w-4 mr-2" />
					{/if}
					{$t('currencies.add')}
				</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Currencies List -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{$t('currencies.list')}</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if loading}
				<div class="flex items-center justify-center py-12">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			{:else if currencies.length === 0}
				<div class="text-center py-12 text-muted-foreground">
					{$t('currencies.noCurrencies')}
				</div>
			{:else}
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>{$t('currencies.code')}</Table.Head>
							<Table.Head>{$t('currencies.symbol')}</Table.Head>
							<Table.Head>{$t('currencies.type')}</Table.Head>
							<Table.Head class="text-right">{$t('common.actions')}</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each currencies as currency}
							<Table.Row>
								<Table.Cell class="font-medium font-mono">{currency.code}</Table.Cell>
								<Table.Cell class="text-lg">{currency.symbol}</Table.Cell>
								<Table.Cell>
									{#if currency.isDefault}
										<Badge variant="default">{$t('currencies.default')}</Badge>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-right">
									{#if !currency.isDefault}
										<Button variant="ghost" size="icon" onclick={() => handleDelete(currency)}>
											<Trash2 class="h-4 w-4 text-destructive" />
										</Button>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
