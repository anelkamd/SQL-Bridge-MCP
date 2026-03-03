/**
 * SQL Bridge - Sliding Window Rate Limiter
 */

export class RateLimiter {
  private timestamps: number[] = []
  private readonly maxRequests: number
  private readonly windowMs: number

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  /**
   * Wait until a request slot is available (iterative, no recursion).
   */
  async checkLimit(): Promise<void> {
    while (true) {
      const now = Date.now()
      const windowStart = now - this.windowMs

      // Prune expired timestamps
      this.timestamps = this.timestamps.filter((ts) => ts > windowStart)

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now)
        return
      }

      // Calculate how long to wait for the oldest request to expire
      const waitTime = this.timestamps[0] - windowStart
      if (waitTime > 0) {
        console.error(`[SQL Bridge] Rate limit reached. Waiting ${waitTime}ms...`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }

  reset(): void {
    this.timestamps = []
  }

  getStats(): { current: number; max: number; window: string } {
    const windowStart = Date.now() - this.windowMs
    const current = this.timestamps.filter((ts) => ts > windowStart).length

    return {
      current,
      max: this.maxRequests,
      window: `${this.windowMs}ms`,
    }
  }
}
