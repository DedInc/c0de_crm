import type { Order } from './types';
import { get } from 'svelte/store';
import { user } from '$lib/stores/auth';

export function canRespond(order: Order | null): boolean {
	if (!order) return false;
	if (order.status !== 'approved') return false;
	if (order.assignedTo) return false;
	const currentUser = get(user);
	return !order.responses.some((r) => r.user?.id === currentUser?.id);
}

export function canModerate(order: Order | null, hasModeratePermission: boolean, adminStatus: boolean): boolean {
	if (!order) return false;
	return order.status === 'pending_moderation' && (hasModeratePermission || adminStatus);
}

export function canAssign(order: Order | null, hasAssignPermission: boolean, adminStatus: boolean): boolean {
	if (!order) return false;
	return (
		(order.status === 'approved' || order.status === 'in_progress') &&
		(hasAssignPermission || adminStatus)
	);
}

export function canUpdateStatus(order: Order | null, hasUpdateStatusPermission: boolean, adminStatus: boolean): boolean {
	if (!order) return false;
	const currentUser = get(user);
	
	if (hasUpdateStatusPermission || adminStatus) {
		return ['in_progress', 'testing', 'completed'].includes(order.status);
	}
	
	if (order.assignedTo?.id === currentUser?.id) {
		return order.status === 'in_progress' || order.status === 'testing';
	}
	return false;
}

export function canManagePermissions(hasAssignPermission: boolean, adminStatus: boolean): boolean {
	return hasAssignPermission || adminStatus;
}

export function getNextStatuses(order: Order | null, hasUpdateStatusPermission: boolean, adminStatus: boolean): string[] {
	if (!order) return [];
	const currentUser = get(user);
	
	const isAssignedProgrammer = order.assignedTo?.id === currentUser?.id &&
		!hasUpdateStatusPermission && !adminStatus;

	if (isAssignedProgrammer) {
		const programmerFlow: Record<string, string[]> = {
			in_progress: ['testing'],
			testing: ['in_progress', 'completed']
		};
		return programmerFlow[order.status] || [];
	}

	const statusFlow: Record<string, string[]> = {
		in_progress: ['testing'],
		testing: ['in_progress', 'completed'],
		completed: ['delivered']
	};
	return statusFlow[order.status] || [];
}
