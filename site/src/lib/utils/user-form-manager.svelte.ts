interface User {
	id: string;
	username: string;
	telegramId: string | null;
	roles: { roleId: string; roleName: string }[];
	markers: { id: string; name: string; color: string }[];
}

export function createUserFormManager() {
	let editingUser = $state<User | null>(null);
	let formUsername = $state('');
	let formPassword = $state('');
	let formTelegramId = $state('');
	let formRoleIds = $state<string[]>([]);
	let formMarkerIds = $state<string[]>([]);
	let formError = $state('');

	function openCreateForm() {
		editingUser = null;
		formUsername = '';
		formPassword = '';
		formTelegramId = '';
		formRoleIds = [];
		formMarkerIds = [];
		formError = '';
	}

	function openEditForm(user: User) {
		editingUser = user;
		formUsername = user.username;
		formPassword = '';
		formTelegramId = user.telegramId || '';
		formRoleIds = user.roles.map((r) => r.roleId);
		formMarkerIds = user.markers.map((m) => m.id);
		formError = '';
	}

	function toggleRole(roleId: string) {
		if (formRoleIds.includes(roleId)) {
			formRoleIds = formRoleIds.filter((id) => id !== roleId);
		} else {
			formRoleIds = [...formRoleIds, roleId];
		}
	}

	function toggleMarker(markerId: string) {
		if (formMarkerIds.includes(markerId)) {
			formMarkerIds = formMarkerIds.filter((id) => id !== markerId);
		} else {
			formMarkerIds = [...formMarkerIds, markerId];
		}
	}

	function validateForm(): string {
		if (!formUsername.trim()) {
			return 'Username is required';
		}

		if (!editingUser && !formPassword) {
			return 'Password is required for new users';
		}

		if (formPassword && formPassword.length < 6) {
			return 'Password must be at least 6 characters';
		}

		return '';
	}

	function getFormData() {
		return {
			username: formUsername,
			password: formPassword || undefined,
			telegramId: formTelegramId || null,
			roleIds: formRoleIds,
			markerIds: formMarkerIds
		};
	}

	return {
		get editingUser() { return editingUser },
		get formUsername() { return formUsername },
		set formUsername(value: string) { formUsername = value },
		get formPassword() { return formPassword },
		set formPassword(value: string) { formPassword = value },
		get formTelegramId() { return formTelegramId },
		set formTelegramId(value: string) { formTelegramId = value },
		get formRoleIds() { return formRoleIds },
		set formRoleIds(value: string[]) { formRoleIds = value },
		get formMarkerIds() { return formMarkerIds },
		set formMarkerIds(value: string[]) { formMarkerIds = value },
		get formError() { return formError },
		set formError(value: string) { formError = value },
		openCreateForm,
		openEditForm,
		toggleRole,
		toggleMarker,
		validateForm,
		getFormData
	};
}
