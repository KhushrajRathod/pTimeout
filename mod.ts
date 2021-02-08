export class TimeoutError extends Error {
    readonly name: 'TimeoutError'
    constructor(message?: string) {
        super(message)
    }
}

/**
Custom implementations for the `setTimeout` and `clearTimeout` functions.
Useful for testing purposes
*/
export interface customTimerOptions {
    setTimeout: typeof setTimeout
    clearTimeout: typeof clearTimeout
}

export interface ClearablePromise<T> extends Promise<T> {
    /**
    Clear the timeout.
    */
    clear: () => void
}

/**
Timeout a promise after a specified amount of time.

@param options.promise - Promise to decorate.
@param options.milliseconds - Milliseconds before timing out.
@param options.fallbackFn - Do something other than rejecting with an error on timeout. You could for example retry.
@param options.failMessage - Specify a custom error message. Default: `'Promise timed out after 50 milliseconds'`.
@param options.failError - Specifgy a custom `Error`. It's recommended to sub-class `pTimeout.TimeoutError`.
@param options.customTimers - Specify custom implementations for the `setTimeout` and `clearTimeout` functions.
@returns A decorated `options.promise` that times out after `options.milliseconds` time. It has a `.clear()` method that clears the timeout.

@example
```
import pTimeout from 'https://deno.land/x/p_timeout/mod.ts

const delayedPromise = new Promise(r => setTimeout(r, 500))

pTimeout(delayedPromise, 50).then(() => 'foo')
//=> [TimeoutError: Promise timed out after 50 milliseconds]
```
*/
export default function pTimeout<T>(options: {
    promise: Promise<T>,
    milliseconds: number,
    fallbackFn?: () => Promise<T>,
    failMessage?: string,
    failError?: Error,
    customTimers?: customTimerOptions
}) {
    let { promise, milliseconds, fallbackFn, failMessage, failError, customTimers } = options
    let timer: number
    const cancelablePromise = new Promise((resolve, reject) => {
        if (milliseconds < 0) {
            throw new TypeError('Expected `milliseconds` to be a positive number')
        }

        if (milliseconds === Infinity) {
            resolve(promise)
            return
        }

        if (!customTimers) customTimers = { setTimeout, clearTimeout }

        timer = customTimers.setTimeout.call(undefined, () => {
            if (fallbackFn) {
                try {
                    resolve(fallbackFn())
                } catch (error) {
                    reject(error)
                }

                return
            }

            const message = failMessage ?? `Promise timed out after ${milliseconds} milliseconds`
            const timeoutError = failError ?? new TimeoutError(message)

            reject(timeoutError)
        }, milliseconds)

        async function run() {
            try {
                resolve(await promise)
            } catch (error) {
                reject(error)
            } finally {
                customTimers.clearTimeout.call(undefined, timer)
            }
        }

        run()
    }) as ClearablePromise<T>

    cancelablePromise.clear = () => {
        clearTimeout(timer)
        timer = undefined
    }

    return cancelablePromise
}