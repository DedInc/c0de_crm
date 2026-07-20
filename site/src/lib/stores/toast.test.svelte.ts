import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { toast, toasts, dismissToast, toastError, toastSuccess, toastInfo, toastWarning } from './toast.svelte';

describe('toast store', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Drain anything left over.
		for (const t of get(toasts)) {
			dismissToast(t.id);
		}
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('appends a new toast and returns its id', () => {
		const id = toast('Hello world');
		const list = get(toasts);
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ id, message: 'Hello world', type: 'info' });
	});

	it('auto-dismisses after the configured duration', () => {
		toast('Auto', 'success', 1000);
		expect(get(toasts)).toHaveLength(1);
		vi.advanceTimersByTime(1000);
		expect(get(toasts)).toHaveLength(0);
	});

	it('does not auto-dismiss when duration is 0', () => {
		const id = toast('Sticky', 'warning', 0);
		vi.advanceTimersByTime(60_000);
		expect(get(toasts)).toHaveLength(1);
		dismissToast(id);
		expect(get(toasts)).toHaveLength(0);
	});

	it('dismissToast removes only the matching toast', () => {
		const a = toast('A', 'info', 0);
		const b = toast('B', 'info', 0);
		dismissToast(a);
		const list = get(toasts);
		expect(list).toHaveLength(1);
		expect(list[0].id).toBe(b);
		dismissToast(b);
	});

	it('helper variants set the right toast type', () => {
		const sId = toastSuccess('S', 0);
		const eId = toastError('E', 0);
		const iId = toastInfo('I', 0);
		const wId = toastWarning('W', 0);

		const types = new Map(get(toasts).map((t) => [t.id, t.type]));
		expect(types.get(sId)).toBe('success');
		expect(types.get(eId)).toBe('error');
		expect(types.get(iId)).toBe('info');
		expect(types.get(wId)).toBe('warning');

		dismissToast(sId);
		dismissToast(eId);
		dismissToast(iId);
		dismissToast(wId);
	});
});
