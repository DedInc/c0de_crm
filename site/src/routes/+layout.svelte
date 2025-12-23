<script lang="ts">
	import '../routes/layout.css';
	import { onMount } from 'svelte';
	import { initLocale } from '$lib/i18n';
	import { checkAuth, isLoading } from '$lib/stores/auth';
	import { initTheme } from '$lib/stores/theme';

	let { children } = $props();

	onMount(() => {
		initLocale();
		initTheme();
		checkAuth();
	});
</script>

{#if $isLoading}
	<div class="flex items-center justify-center min-h-screen">
		<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
	</div>
{:else}
	{@render children()}
{/if}
