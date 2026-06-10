import { describe, expect, test } from "bun:test";
import { AbortError, Semaphore } from "@/dub/course/engine/semaphore";

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("Semaphore", () => {
	test("limits concurrency to the permit count", async () => {
		const sem = new Semaphore(2);
		let running = 0;
		let peak = 0;
		const job = () =>
			sem.withPermit(async () => {
				running++;
				peak = Math.max(peak, running);
				await tick();
				running--;
			});
		await Promise.all([job(), job(), job(), job(), job()]);
		expect(peak).toBe(2);
		expect(running).toBe(0);
	});

	test("release wakes a waiter (FIFO)", async () => {
		const sem = new Semaphore(1);
		const order: number[] = [];
		await sem.acquire();
		const w1 = sem.acquire().then(() => order.push(1));
		const w2 = sem.acquire().then(() => order.push(2));
		sem.release();
		await w1;
		sem.release();
		await w2;
		expect(order).toEqual([1, 2]);
		sem.release();
	});

	test("withPermit releases on throw", async () => {
		const sem = new Semaphore(1);
		await expect(
			sem.withPermit(async () => {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");
		// permit must be back: this acquire resolves immediately
		await sem.withPermit(async () => {});
	});

	test("acquire rejects with AbortError when signal aborts while waiting", async () => {
		const sem = new Semaphore(1);
		await sem.acquire();
		const ctrl = new AbortController();
		const waiting = sem.acquire(ctrl.signal);
		ctrl.abort();
		await expect(waiting).rejects.toBeInstanceOf(AbortError);
		// the held permit is still valid; release then re-acquire works
		sem.release();
		await sem.withPermit(async () => {});
	});

	test("acquire rejects immediately on an already-aborted signal", async () => {
		const sem = new Semaphore(1);
		const ctrl = new AbortController();
		ctrl.abort();
		await expect(sem.acquire(ctrl.signal)).rejects.toBeInstanceOf(AbortError);
	});
});
