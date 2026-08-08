import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RateLimit } from '@/rate-limit.decorator.js'
import { RateLimitExceededError } from '@/rate-limit.errors.js'
import type { RateLimitService } from '@/rate-limit.service.js'

const mockRateLimitService = {
	consume: vi.fn(),
} as unknown as RateLimitService

class TestService {
	public rateLimitService = mockRateLimitService
	public executions = 0

	@RateLimit<
		[
			string,
		]
	>(([userId]) => `charge:${userId}`, {
		limit: 5,
		window: 60_000,
	})
	async charge(userId: string) {
		this.executions += 1
		return `charged:${userId}`
	}

	@RateLimit('static:charge', {
		limit: 1,
		window: 1_000,
	})
	async chargeStatic() {
		return 'charged'
	}

	@RateLimit(([userId]) => `untyped:${userId}`, {
		limit: 2,
		window: 2_000,
	})
	async chargeUntyped(userId: string) {
		return `charged:${userId}`
	}
}

describe('@RateLimit', () => {
	let service: TestService

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(mockRateLimitService.consume).mockResolvedValue(undefined)

		service = new TestService()
		service.rateLimitService = mockRateLimitService
	})

	it('should consume one unit with the derived key and options', async () => {
		await service.charge('123')

		expect(mockRateLimitService.consume).toHaveBeenCalledWith('charge:123', {
			limit: 5,
			window: 60_000,
		})
	})

	it('should return the original method result when within the limit', async () => {
		await expect(service.charge('123')).resolves.toBe('charged:123')
		expect(service.executions).toBe(1)
	})

	it('should accept a static string key', async () => {
		await expect(service.chargeStatic()).resolves.toBe('charged')
		expect(mockRateLimitService.consume).toHaveBeenCalledWith('static:charge', {
			limit: 1,
			window: 1_000,
		})
	})

	it('should work without an explicit tuple generic', async () => {
		await expect(service.chargeUntyped('9')).resolves.toBe('charged:9')
		expect(mockRateLimitService.consume).toHaveBeenCalledWith('untyped:9', {
			limit: 2,
			window: 2_000,
		})
	})

	it('should not execute the method when the limit is exceeded', async () => {
		vi.mocked(mockRateLimitService.consume).mockRejectedValue(
			new RateLimitExceededError('charge:123'),
		)

		await expect(service.charge('123')).rejects.toThrow(RateLimitExceededError)
		expect(service.executions).toBe(0)
	})
})
