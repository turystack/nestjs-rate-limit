import type { CacheModuleOptions } from '@turystack/nestjs-cache'

/** Options for {@link RateLimitService.consume}. */
export type RateLimitOptions = {
	/** Maximum number of allowed requests within the window. */
	limit: number
	/** Time window in milliseconds. */
	window: number
}

/**
 * Options for {@link RateLimitModule.register}. If omitted, reuses the
 * existing CacheModule from DI.
 *
 * Mirrors `CacheModuleOptions`: storage comes from a cache adapter, so any
 * adapter supported by `@turystack/nestjs-cache` works here (Redis is the
 * built-in option).
 */
export type RateLimitModuleOptions = CacheModuleOptions
