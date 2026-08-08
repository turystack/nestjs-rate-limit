import { Inject } from '@nestjs/common'
import { type CacheKeyResolver, resolveCacheKey } from '@turystack/nestjs-cache'

import { RateLimitService } from '@/rate-limit.service.js'
import type { RateLimitOptions } from '@/rate-limit.types.js'

/**
 * Method decorator that enforces a rate-limit before execution.
 *
 * Auto-injects {@link RateLimitService} into the class instance.
 *
 * Uses the same key-resolution engine as `@Cache.*`: pass a static string, or
 * a resolver that receives the method arguments as a tuple. The tuple generic
 * is optional — pass it when you want the arguments typed.
 *
 * @param key - Static key or resolver function receiving the method arguments.
 * @param options - Rate-limit configuration (limit and window).
 *
 * @example
 * ```ts
 * import { RateLimit } from '@turystack/nestjs-rate-limit'
 *
 * class PaymentsService {
 *   @RateLimit(([userId]) => `charge:${userId}`, { limit: 5, window: 60_000 })
 *   async charge(userId: string) {
 *     // automatically rate-limited
 *   }
 *
 *   // Optionally type the args tuple:
 *   @RateLimit<[string]>(([userId]) => `refund:${userId}`, { limit: 1, window: 60_000 })
 *   async refund(userId: string) {}
 * }
 * ```
 */
export function RateLimit<T extends unknown[] = unknown[]>(
	key: CacheKeyResolver<T>,
	options: RateLimitOptions,
): MethodDecorator {
	return (
		target: object,
		_propertyKey: string | symbol,
		descriptor: PropertyDescriptor,
	) => {
		Inject(RateLimitService)(target, 'rateLimitService')
		const original = descriptor.value

		descriptor.value = async function (
			this: Record<string, unknown>,
			...args: unknown[]
		) {
			const rateLimitService = this.rateLimitService as RateLimitService
			const resolvedKey = await resolveCacheKey(key, args as T)
			await rateLimitService.consume(resolvedKey, options)
			return original.apply(this, args)
		}

		return descriptor
	}
}
