import { HttpException, HttpStatus } from '@nestjs/common'

/** Thrown when the rate-limit for a given key has been exceeded within the time window. HTTP 429. */
export class RateLimitExceededError extends HttpException {
	constructor(key: string) {
		super(`Rate limit exceeded for key "${key}"`, HttpStatus.TOO_MANY_REQUESTS)
	}
}
