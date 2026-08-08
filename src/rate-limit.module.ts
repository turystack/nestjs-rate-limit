import { type DynamicModule, Module } from '@nestjs/common'
import { LazyModuleLoader } from '@nestjs/core'
import { CacheModule, CacheService } from '@turystack/nestjs-cache'
import { ConfigService } from '@turystack/nestjs-config'

import { RateLimitService } from '@/rate-limit.service.js'
import type { RateLimitModuleOptions } from '@/rate-limit.types.js'

@Module({})
export class RateLimitModule {
	/**
	 * Registers the rate limiter globally. Without options it reuses the
	 * app-wide connection from `CacheModule.register()` (register the cache
	 * once in the app root); with options it registers its own CacheModule.
	 * The `(config) => options` factory form resolves the options from the
	 * `ConfigService` at boot — requires ConfigModule
	 * (`@turystack/nestjs-config`) to be registered.
	 */
	static register(
		options?:
			| RateLimitModuleOptions
			| ((config: ConfigService) => RateLimitModuleOptions),
	): DynamicModule {
		const imports =
			options && typeof options !== 'function'
				? [
						CacheModule.register(options),
					]
				: []

		return {
			exports: [
				RateLimitService,
			],
			global: true,
			imports,
			module: RateLimitModule,
			providers: [
				{
					inject: [
						LazyModuleLoader,
						{
							optional: true,
							token: CacheService,
						},
						{
							optional: true,
							token: ConfigService,
						},
					],
					provide: RateLimitService,
					useFactory: async (
						lazyModuleLoader: LazyModuleLoader,
						cacheService?: CacheService,
						config?: ConfigService,
					) => {
						if (typeof options === 'function') {
							const resolvedOptions = RateLimitModule._resolveOptions(
								options,
								config,
							)
							const cacheModuleRef = await lazyModuleLoader.load(() =>
								CacheModule.register(resolvedOptions),
							)

							return new RateLimitService(cacheModuleRef.get(CacheService))
						}

						if (!cacheService) {
							throw new Error(
								'RateLimitModule requires CacheModule to be imported or a provider config to be passed to RateLimitModule.register()',
							)
						}

						return new RateLimitService(cacheService)
					},
				},
			],
		}
	}

	private static _resolveOptions(
		options:
			| RateLimitModuleOptions
			| ((config: ConfigService) => RateLimitModuleOptions),
		config?: ConfigService,
	): RateLimitModuleOptions {
		if (typeof options !== 'function') {
			return options
		}

		if (!config) {
			throw new Error(
				'[RateLimitModule] register((config) => ...) requires ConfigModule (@turystack/nestjs-config) to be registered',
			)
		}

		return options(config)
	}
}
