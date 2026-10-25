'use client'
import { createActionError } from '@/services/actionError'
import { useState, useEffect } from 'react'
import type { ActionReturn, ActionError } from '@/services/actionTypes'

/**
 * You sometimes want to call a server action that reads from the client. This hook helps with that.
 * @param action - A server action to call
 * @returns The data returned from the server action. If success is false, the error is returned instead.
 */
export default function useActionCall<
    Data,
>(
    action: () => Promise<ActionReturn<Data>>
) {
    const [res, setRes] = useState<{
        data: Data | null,
        error: null
    } | {
        data: null,
        error: ActionError
    }>({
        data: null,
        error: null
    })

    useEffect(() => {
        action().then((result) => {
            if (result.success) {
                setRes({ data: result.data, error: null })
            } else {
                setRes({ data: null, error: result })
            }
        }).catch(() => {
            setRes({ data: null, error: createActionError('UNKNOWN ERROR', 'Det oppstod en ukjent feil') })
        })
    }, [action])

    return res
}
