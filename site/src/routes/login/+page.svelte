<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { login, isAuthenticated } from '$lib/stores/auth';
	import { t, locale, setLocale, type Locale } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { ThemeToggle } from '$lib/components/ui/theme-toggle';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	onMount(() => {
		const unsubscribe = isAuthenticated.subscribe((authenticated) => {
			if (authenticated) {
				goto('/dashboard');
			}
		});
		return unsubscribe;
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		const result = await login(username, password);
		
		if (result.success) {
			goto('/dashboard');
		} else {
			// Use translation key if provided, otherwise use error message or fallback
			error = result.errorKey ? $t(result.errorKey) : (result.error || $t('auth.invalidCredentials'));
		}
		
		loading = false;
	}

	function toggleLocale() {
		const newLocale: Locale = $locale === 'en' ? 'ru' : 'en';
		setLocale(newLocale);
	}
</script>

<div class="min-h-screen flex items-center justify-center bg-background p-4">
	<div class="absolute top-4 right-4 flex items-center gap-2">
		<ThemeToggle />
		<Button variant="outline" size="sm" onclick={toggleLocale}>
			{$locale === 'en' ? 'RU' : 'EN'}
		</Button>
	</div>

	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1">
			<Card.Title class="text-2xl font-bold text-center">
				{$t('common.appName')}
			</Card.Title>
			<Card.Description class="text-center">
				{$t('auth.loginTitle')}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={handleSubmit} class="space-y-4">
				{#if error}
					<div class="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
						{error}
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="username">{$t('auth.username')}</Label>
					<Input
						id="username"
						type="text"
						bind:value={username}
						placeholder={$t('auth.username')}
						required
						disabled={loading}
					/>
				</div>

				<div class="space-y-2">
					<Label for="password">{$t('auth.password')}</Label>
					<Input
						id="password"
						type="password"
						bind:value={password}
						placeholder={$t('auth.password')}
						required
						disabled={loading}
					/>
				</div>

				<Button type="submit" class="w-full" disabled={loading}>
					{#if loading}
						<span class="animate-spin mr-2">⏳</span>
					{/if}
					{$t('auth.loginButton')}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>