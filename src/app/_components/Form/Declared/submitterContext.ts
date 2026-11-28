'use client'
import { createContext } from 'react'
import type { FormStore } from './formStore'
import type { SaveStatus } from '@/components/UI/SaveStatusIcon'

/**
 * What a part of a form reads of the submitter it is inside, whichever submitter that is: the state
 * of its save, and nothing of its values. It is null outside every submitter.
 */
export const SubmitterContext = createContext<SubmitterState | null>(null)

export type SubmitterState = {
    subscribe: (listener: () => void) => () => void,
    saveStatus: () => SaveStatus,
}

export function submitterStateOf(store: FormStore): SubmitterState {
    return { subscribe: store.subscribeToForm, saveStatus: store.saveStatus }
}
