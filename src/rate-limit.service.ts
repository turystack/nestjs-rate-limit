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
	 * Fixed window: the counter is incremented atomically, and the window is
	 * set on the increment that created the key — later calls, including the
	 * rejected ones, do not push it further away. If the counter exceeds the
	 * limit the increment is rolled back and an error is thrown.
	 *
	 * @throws {RateLimitExceededError} If the limit has been exceeded within the window.
	 */
	async consume(key: string, options: RateLimitOptions): Promise<void> {
		const rateLimitKey = `rate-limit:${key}`
		const current = await this.cacheService.incr(rateLimitKey, {
			// The window starts on the first hit and is not pushed further away by
			// the ones after it — including the rejected ones. Rewriting the expiry
			// on every call meant a caller under sustained traffic was throttled
			// until they went quiet for a whole window.
			expiry: 'on-create',
			// `window` is milliseconds; `CacheOptions.ttl` is seconds. Passing one
			// for the other stretched the window 1000x — a 60 s limit reset after
			// 16 hours. Rounded up, so a sub-second window never floors to a key
			// with no expiry.
			ttl: Math.ceil(options.window / 1000),
		})

		if (current > options.limit) {
			await this.cacheService.decr(rateLimitKey)
			throw new RateLimitExceededError(key)
		}
	}
}
