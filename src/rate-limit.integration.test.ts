import { Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import {
	CACHE_ADAPTER_REDIS,
	CacheModule,
	CacheService,
} from '@turystack/nestjs-cache'
import { describe, expect, it } from 'vitest'

import { RateLimitModule } from '@/rate-limit.module.js'
import { RateLimitService } from '@/rate-limit.service.js'

@Injectable()
class DomainService {
	constructor(
		public readonly cacheService: CacheService,
		public readonly rateLimitService: RateLimitService,
	) {}
}

@Module({
	providers: [
		DomainService,
	],
})
class DomainLibModule {}

describe('RateLimitModule (integration)', () => {
	it('should share the app-wide CacheService and inject into domain libs', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [
				CacheModule.register({
					adapter: 'redis',
					redis: {
						url: 'redis://test:6379',
					},
				}),
				RateLimitModule.register(),
				DomainLibModule,
			],
		})
			.overrideProvider(CACHE_ADAPTER_REDIS)
			.useValue({})
			.compile()

		const domainService = moduleRef.get(DomainService)
		expect(domainService.cacheService).toBeInstanceOf(CacheService)
		expect(domainService.rateLimitService).toBeInstanceOf(RateLimitService)

		// One connection app-wide: the lib and the rate limiter share the exact
		// same CacheService singleton (and therefore the same adapter connection).
		const sharedCacheService = moduleRef.get(CacheService)
		expect(domainService.cacheService).toBe(sharedCacheService)
		expect(
			(domainService.rateLimitService as unknown as Record<string, unknown>)
				.cacheService,
		).toBe(sharedCacheService)
	})
})
