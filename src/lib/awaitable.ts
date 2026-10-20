/**
 * A value or a promise of it. Use it for callbacks whose result is awaited, so they don't have to
 * be async when they have nothing to wait for.
 */
export type Awaitable<T> = T | Promise<T>
