# Rate-Limit

Distributed rate-limiting module with decorator support. Storage comes from `@turystack/nestjs-cache`, which is adapter-based — any cache adapter works; Redis is the built-in adapter option.

## Setup

Preferred: register `CacheModule` **once** in the app root and call `RateLimitModule.register()` with no options — the rate limiter reuses the app-wide connection instead of opening its own. Both registrations are global, so domain services in monorepo libs just inject `RateLimitService` without importing anything.

```ts
import { ConfigModule, defineConfigSchema } from '@turystack/nestjs-config'
import { RateLimitModule } from '@turystack/nestjs-rate-limit'
import { z } from 'zod'

// Preferred: one shared connection for cache, lock, and rate-limit
@Module({
  imports: [
    CacheModule.register({ adapter: 'redis', redis: { url: process.env.REDIS_URL } }),
    RateLimitModule.register(),
  ],
})
class AppModule {}

// Standalone: own storage config (same options as CacheModule.register) —
// opens a dedicated connection; only use when isolation is intentional
export const configSchema = defineConfigSchema({
  REDIS_URL: z.string(),
})

declare module '@turystack/nestjs-config' {
  interface ConfigSchemaRegistry {
    schema: typeof configSchema
  }
}

@Module({
  imports: [
    ConfigModule.register({ schema: configSchema }),
    RateLimitModule.register((config) => ({
      adapter: 'redis',
      redis: { url: config.get('REDIS_URL') },
    })),
  ],
})
class AppModule {}
```

`register` also accepts a plain options object; the `(config) => options` form injects the `ConfigService` at boot.

## RateLimitService

Injectable service available after module registration.

```ts
import { RateLimitService } from '@turystack/nestjs-rate-limit'

class PaymentsService {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async charge(userId: string) {
    await this.rateLimitService.consume(`charge:${userId}`, {
      limit: 5,
      window: 60_000,
    })

    // proceed with charge
  }
}
```

### Methods

| Method | Signature | Description |
|---|---|---|
| `consume` | `consume(key: string, options: RateLimitOptions): Promise<void>` | Consume one unit; throws if limit exceeded |

## Decorator

### `@RateLimit(key, options)`

Enforces rate-limit before method execution. Uses the same key-resolution engine as `@Cache.*`: a static string, or a resolver receiving the method arguments as a tuple. The tuple generic is optional — pass it when you want the arguments typed.

```ts
import { RateLimit } from '@turystack/nestjs-rate-limit'

class PaymentsService {
  @RateLimit(([userId]) => `charge:${userId}`, { limit: 5, window: 60_000 })
  async charge(userId: string) {
    // automatically rate-limited
  }

  // Optionally type the args tuple:
  @RateLimit<[string]>(([userId]) => `refund:${userId}`, { limit: 1, window: 60_000 })
  async refund(userId: string) {}
}
```

## Types

```ts
type RateLimitOptions = {
  limit: number   // Max requests within window
  window: number  // Time window in ms
}

// Same shape as CacheModuleOptions: pick a storage adapter and its config.
type RateLimitModuleOptions = CacheModuleOptions
```

## Errors

| Error | Description |
|---|---|
| `RateLimitExceededError` | Thrown when limit is exceeded within the window |
