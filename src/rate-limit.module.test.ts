import type { FactoryProvider } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { CacheModule, CacheService } from '@turystack/nestjs-cache'
import { ConfigModule } from '@turystack/nestjs-config'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { RateLimitModule } from '@/rate-limit.module.js'
import { RateLimitService } from '@/rate-limit.service.js'

const getRateLimitServiceProvider = (
	options?: Parameters<typeof RateLimitModule.register>[0],
) => {
	const dynamicModule = RateLimitModule.register(options)
	return {
		dynamicModule,
		provider: dynamicModule.providers?.find(
			(provider) =>
				typeof provider === 'object' &&
				'provide' in provider &&
				provider.provide === RateLimitService,
		) as FactoryProvider,
	}
}

describe('RateLimitModule', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	describe('register', () => {
		it('should reuse the existing CacheModule when no options are given', () => {
			const { dynamicModule } = getRateLimitServiceProvider()

			expect(dynamicModule.module).toBe(RateLimitModule)
			expect(dynamicModule.global).toBe(true)
			expect(dynamicModule.imports).toEqual([])
			expect(dynamicModule.exports).toEqual([
				RateLimitService,
			])
		})

		it('should register its own CacheModule when options are given', () => {
			const { dynamicModule } = getRateLimitServiceProvider({
				adapter: 'redis',
				redis: {
					url: 'redis://localhost:6379',
				},
			})

			expect(dynamicModule.imports).toHaveLength(1)
			expect(dynamicModule.imports?.[0]).toMatchObject({
				module: CacheModule,
			})
		})

		it('should build RateLimitService from the injected CacheService', async () => {
			const { provider } = getRateLimitServiceProvider()
			const cacheService = {} as CacheService

			await expect(
				provider.useFactory({}, cacheService),
			).resolves.toBeInstanceOf(RateLimitService)
		})

		it('should throw when no CacheService is available', async () => {
			const { provider } = getRateLimitServiceProvider()

			await expect(provider.useFactory({}, undefined)).rejects.toThrow(
				'RateLimitModule requires CacheModule',
			)
		})

		it('should resolve options from a config factory', async () => {
			const cacheService = {} as CacheService
			const registerSpy = vi.spyOn(CacheModule, 'register').mockReturnValue({
				exports: [
					CacheService,
				],
				module: CacheModule,
				providers: [
					{
						provide: CacheService,
						useValue: cacheService,
					},
				],
			})

			vi.stubEnv('REDIS_URL', 'redis://localhost:6379')

			try {
				const moduleRef = await Test.createTestingModule({
					imports: [
						ConfigModule.register({
							envFilePath: false,
							schema: {
								REDIS_URL: z.string(),
							},
						}),
						RateLimitModule.register((config) => ({
							adapter: 'redis',
							redis: {
								url: config.get('REDIS_URL') as string,
							},
						})),
					],
				}).compile()

				expect(moduleRef.get(RateLimitService)).toBeInstanceOf(RateLimitService)
				expect(registerSpy).toHaveBeenCalledWith({
					adapter: 'redis',
					redis: {
						url: 'redis://localhost:6379',
					},
				})
			} finally {
				registerSpy.mockRestore()
			}
		})

		it('should reject a config factory without ConfigModule', async () => {
			await expect(
				Test.createTestingModule({
					imports: [
						RateLimitModule.register((config) => ({
							adapter: 'redis',
							redis: {
								url: config.get('REDIS_URL') as string,
							},
						})),
					],
				}).compile(),
			).rejects.toThrow(
				'requires ConfigModule (@turystack/nestjs-config) to be registered',
			)
		})
	})
})
