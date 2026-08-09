import { Inject, Injectable } from '@nestjs/common'
import { CacheService } from '@turystack/nestjs-cache'

import { RateLimitExceededError } from '@/rate-limit.errors.js'
import type { RateLimitOptions } from '@/rate-limit.types.js'

/**
 * Service for enforcing distributed rate-limits via the cache adapter
 * (Redis is the built-in option).
 *
 * @example
 * ```ts
 * import { RateLimitService } from '@turystack/nestjs-rate-limit'
 *
 * @Injectable()
 * class PaymentsService {
 *   constructor(private readonly rateLimit: RateLimitService) {}
 *
 *   async charge(userId: string) {
 *     await this.rateLimit.consume(`charge:${userId}`, { limit: 5, window: 60_000 })
 *     // proceed with charge
 *   }
 * }
 * ```
 */
@Injectable()
export class RateLimitService {
	constructor(
		@Inject(CacheService)
		private readonly cacheService: CacheService,
	) {}

	/**
	 * Consumes one unit from the rate-limit bucket for the given key.
	 *
	 * Increments the counter atomically and sets the TTL to the window duration.
	 * If the counter exceeds the limit, the increment is rolled back and an error is thrown.
	 *
	 * @throws {RateLimitExceededError} If the limit has been exceeded within the window.
	 */
	async consume(key: string, options: RateLimitOptions): Promise<void> {
		const rateLimitKey = `rate-limit:${key}`
		// `window` is milliseconds; `CacheOptions.ttl` is seconds. Passing one for
		// the other stretched the window 1000x — a 60 s limit reset after 16 hours.
		// Rounded up, so a sub-second window never floors to a key with no expiry.
		const current = await this.cacheService.incr(rateLimitKey, {
			ttl: Math.ceil(options.window / 1000),
		})

		if (current > options.limit) {
			await this.cacheService.decr(rateLimitKey)
			throw new RateLimitExceededError(key)
		}
	}
}
