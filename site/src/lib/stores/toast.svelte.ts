import { toStore } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration: number;
}

let toastList = $state<Toast[]>([]);
let counter = 0;

export const toasts = toStore(() => toastList);

export function toast(message: string, type: ToastType = 'info', duration = 4000): string {
	const id = `toast-${++counter}`;
	toastList = [...toastList, { id, type, message, duration }];
	if (duration > 0) {
		setTimeout(() => dismissToast(id), duration);
	}
	return id;
}

export function dismissToast(id: string): void {
	toastList = toastList.filter((t) => t.id !== id);
}

export const toastSuccess = (msg: string, duration?: number) => toast(msg, 'success', duration);
export const toastError = (msg: string, duration?: number) => toast(msg, 'error', duration ?? 6000);
export const toastInfo = (msg: string, duration?: number) => toast(msg, 'info', duration);
export const toastWarning = (msg: string, duration?: number) => toast(msg, 'warning', duration);
