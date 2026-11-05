import { useRef, useCallback, useEffect } from 'react'

/**
 * This hook debounces a function. It takes a function and returns a function that can be called
 * but it will only call the original function after a certain amount of time has passed since the last call.
 * @param func
 */
export function useDebounce<T>(func: (param: T) => void, timeout: number): (param: T) => void {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const latestFunc = useRef(func)

    useEffect(() => {
        latestFunc.current = func
    }, [func])

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current)
    }, [])

    return useCallback((param: T) => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
            latestFunc.current(param)
            timer.current = null
        }, timeout)
    }, [timeout])
}
