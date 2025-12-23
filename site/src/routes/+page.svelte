<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { isAuthenticated } from '$lib/stores/auth';

	onMount(() => {
		const unsubscribe = isAuthenticated.subscribe((authenticated) => {
			if (authenticated) {
				goto('/dashboard');
			} else {
				goto('/login');
			}
		});

		return unsubscribe;
	});
</script>

<div class="flex items-center justify-center min-h-screen">
	<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
</div>
