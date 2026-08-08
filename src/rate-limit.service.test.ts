import { Test } from '@nestjs/testing'
import { CacheService } from '@turystack/nestjs-cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RateLimitExceededError } from '@/rate-limit.errors.js'
import { RateLimitService } from '@/rate-limit.service.js'

describe('RateLimitService', () => {
	let service: RateLimitService
	let cacheService: CacheService

	beforeEach(async () => {
		const moduleRef = await Test.createTestingModule({
			providers: [
				RateLimitService,
				{
					provide: CacheService,
					useValue: {
						decr: vi.fn(),
						incr: vi.fn(),
					},
				},
			],
		}).compile()

		service = moduleRef.get<RateLimitService>(RateLimitService)
		cacheService = moduleRef.get<CacheService>(CacheService)
	})

	describe('consume', () => {
		it('should allow request when under the limit', async () => {
			vi.mocked(cacheService.incr).mockResolvedValue(1)

			await expect(
				service.consume('user:123', {
					limit: 10,
					window: 60_000,
				}),
			).resolves.toBeUndefined()

			expect(cacheService.incr).toHaveBeenCalledWith('rate-limit:user:123', {
				ttl: 60_000,
			})
		})

		it('should allow request at exactly the limit', async () => {
			vi.mocked(cacheService.incr).mockResolvedValue(10)

			await expect(
				service.consume('user:123', {
					limit: 10,
					window: 60_000,
				}),
			).resolves.toBeUndefined()
		})

		it('should throw RateLimitExceededError when over the limit', async () => {
			vi.mocked(cacheService.incr).mockResolvedValue(11)
			vi.mocked(cacheService.decr).mockResolvedValue(10)

			await expect(
				service.consume('user:123', {
					limit: 10,
					window: 60_000,
				}),
			).rejects.toThrow(RateLimitExceededError)
		})

		it('should decrement counter when rate limit is exceeded', async () => {
			vi.mocked(cacheService.incr).mockResolvedValue(6)
			vi.mocked(cacheService.decr).mockResolvedValue(5)

			await expect(
				service.consume('user:123', {
					limit: 5,
					window: 60_000,
				}),
			).rejects.toThrow(RateLimitExceededError)

			expect(cacheService.decr).toHaveBeenCalledWith('rate-limit:user:123')
		})

		it('should throw error with descriptive message and HTTP 429', async () => {
			vi.mocked(cacheService.incr).mockResolvedValue(2)
			vi.mocked(cacheService.decr).mockResolvedValue(1)

			await expect(
				service.consume('api:endpoint', {
					limit: 1,
					window: 1000,
				}),
			).rejects.toThrow('Rate limit exceeded for key "api:endpoint"')

			try {
				await service.consume('api:endpoint', {
					limit: 1,
					window: 1000,
				})
			} catch (error) {
				expect((error as RateLimitExceededError).getStatus()).toBe(429)
			}
		})
	})
})
