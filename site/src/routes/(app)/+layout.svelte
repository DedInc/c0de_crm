<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { user, isAuthenticated, logout, hasPermission, isAdmin } from '$lib/stores/auth';
	import { t, locale, setLocale, type Locale } from '$lib/i18n';
	import { theme, setTheme, type Theme } from '$lib/stores/theme';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Separator } from '$lib/components/ui/separator';
	import { ThemeToggle } from '$lib/components/ui/theme-toggle';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Kanban from '@lucide/svelte/icons/kanban';
	import Users from '@lucide/svelte/icons/users';
	import Shield from '@lucide/svelte/icons/shield';
	import Tags from '@lucide/svelte/icons/tags';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import Settings from '@lucide/svelte/icons/settings';
	import LogOut from '@lucide/svelte/icons/log-out';
	import User from '@lucide/svelte/icons/user';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Monitor from '@lucide/svelte/icons/monitor';

	let { children } = $props();
	let sidebarOpen = $state(false);

	onMount(() => {
		const unsubscribe = isAuthenticated.subscribe((authenticated) => {
			if (!authenticated) {
				goto('/login');
			}
		});
		return unsubscribe;
	});

	async function handleLogout() {
		await logout();
		goto('/login');
	}

	function toggleLocale() {
		const newLocale: Locale = $locale === 'en' ? 'ru' : 'en';
		setLocale(newLocale);
	}

	function cycleTheme() {
		const current = $theme;
		let next: Theme;
		if (current === 'light') {
			next = 'dark';
		} else if (current === 'dark') {
			next = 'system';
		} else {
			next = 'light';
		}
		setTheme(next);
	}

	function getThemeIcon(t: Theme) {
		if (t === 'light') return Sun;
		if (t === 'dark') return Moon;
		return Monitor;
	}

	function getThemeLabel(t: Theme): string {
		if (t === 'light') return 'Light';
		if (t === 'dark') return 'Dark';
		return 'System';
	}

	function closeSidebar() {
		sidebarOpen = false;
	}

	interface NavItem {
		href: string;
		label: string;
		icon: typeof LayoutDashboard;
		permission?: string;
		adminOnly?: boolean;
	}

	const navItems: NavItem[] = [
		{ href: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard },
		{ href: '/orders', label: 'nav.orders', icon: ClipboardList, permission: 'view_orders' },
		{ href: '/kanban', label: 'nav.kanban', icon: Kanban, permission: 'view_orders' },
		{ href: '/chat', label: 'nav.chat', icon: MessageSquare, permission: 'chat_customers' },
		{ href: '/users', label: 'nav.users', icon: Users, permission: 'manage_users' },
		{ href: '/roles', label: 'nav.roles', icon: Shield, permission: 'manage_roles' },
		{ href: '/markers', label: 'nav.markers', icon: Tags, permission: 'manage_markers' },
		{ href: '/payment-methods', label: 'nav.paymentMethods', icon: CreditCard, adminOnly: true }
	];

	function canAccess(item: NavItem): boolean {
		if (isAdmin()) return true;
		if (item.adminOnly) return false;
		if (item.permission) return hasPermission(item.permission);
		return true;
	}
</script>

<div class="min-h-screen bg-background">
	<!-- Mobile header -->
	<div class="lg:hidden flex items-center justify-between p-4 border-b">
		<Button variant="ghost" size="icon" onclick={() => sidebarOpen = !sidebarOpen}>
			{#if sidebarOpen}
				<X class="h-6 w-6" />
			{:else}
				<Menu class="h-6 w-6" />
			{/if}
		</Button>
		<span class="font-bold text-lg">{$t('common.appName')}</span>
		<ThemeToggle />
	</div>

	<div class="flex">
		<!-- Sidebar -->
		<aside class="
			{sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
			lg:translate-x-0
			fixed lg:static
			inset-y-0 left-0
			z-50
			w-64
			bg-card
			border-r
			transition-transform
			duration-200
			ease-in-out
			pt-4 lg:pt-0
		">
			<div class="flex flex-col h-full">
				<!-- Logo -->
				<div class="hidden lg:flex items-center justify-center h-16 border-b">
					<span class="font-bold text-xl">{$t('common.appName')}</span>
				</div>

				<!-- Navigation -->
				<nav class="flex-1 p-4 space-y-1 overflow-y-auto">
					{#each navItems as item}
						{#if canAccess(item)}
							<a
								href={item.href}
								onclick={closeSidebar}
								class="
									flex items-center gap-3 px-3 py-2 rounded-md text-sm
									transition-colors
									{$page.url.pathname === item.href || $page.url.pathname.startsWith(item.href + '/')
										? 'bg-primary text-primary-foreground'
										: 'hover:bg-muted'}
								"
							>
								<item.icon class="h-5 w-5" />
								{$t(item.label)}
							</a>
						{/if}
					{/each}
				</nav>

				<Separator />

				<!-- User section -->
				<div class="p-4">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger>
							<Button variant="ghost" class="w-full justify-start gap-3">
								<User class="h-5 w-5" />
								<span class="truncate">{$user?.username}</span>
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content class="w-56">
							<DropdownMenu.Label>{$user?.username}</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.Item>
								<a href="/profile" class="flex items-center gap-2 w-full">
									<Settings class="h-4 w-4" />
									{$t('nav.profile')}
								</a>
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={toggleLocale}>
								<span class="flex items-center gap-2">
									🌐 {$locale === 'en' ? 'Русский' : 'English'}
								</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={cycleTheme}>
								{@const ThemeIcon = getThemeIcon($theme)}
								<span class="flex items-center gap-2">
									<ThemeIcon class="h-4 w-4" />
									{getThemeLabel($theme)}
								</span>
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item onclick={handleLogout}>
								<span class="flex items-center gap-2 text-destructive">
									<LogOut class="h-4 w-4" />
									{$t('auth.logout')}
								</span>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</div>
		</aside>

		<!-- Overlay for mobile -->
		{#if sidebarOpen}
			<div
				class="fixed inset-0 bg-black/50 z-40 lg:hidden"
				onclick={closeSidebar}
				onkeydown={(e) => e.key === 'Escape' && closeSidebar()}
				role="button"
				tabindex="0"
			></div>
		{/if}

		<!-- Main content -->
		<main class="flex-1 p-4 lg:p-8 min-h-screen">
			{@render children()}
		</main>
	</div>
</div>