<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
</script>

<div class="min-h-screen flex items-center justify-center p-4">
	<div class="text-center max-w-md">
		<AlertTriangle class="h-16 w-16 mx-auto mb-6 text-destructive opacity-80" />
		<h1 class="text-4xl font-bold mb-2">{page.status}</h1>
		<p class="text-lg text-muted-foreground mb-6">
			{page.error?.message || 'Something went wrong'}
		</p>
		<div class="flex gap-3 justify-center">
			<Button variant="outline" onclick={() => history.back()}>
				Go Back
			</Button>
			<a href="/">
				<Button>Home</Button>
			</a>
		</div>
	</div>
</div>
