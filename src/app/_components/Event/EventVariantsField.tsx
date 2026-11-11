'use client'
import { toVariantDrafts, variantDraftsToField } from './eventSetupDraft'
import { createContext, useContext, useState } from 'react'
import type { VariantDraft } from './eventSetupDraft'
import type { EventVariantExpanded } from '@/services/events/variants/types'
import type { ReactNode } from 'react'

type EventVariantsFieldContextType = {
    name: string,
    variants: VariantDraft[],
    setVariants: (variants: VariantDraft[]) => void,
}

const EventVariantsFieldContext = createContext<EventVariantsFieldContextType | null>(null)

function useField() {
    const field = useContext(EventVariantsFieldContext)
    if (!field) throw new Error('Må ligge inni EventVariantsField')
    return field
}

/**
 * The variants and quotas of an event as one field of a form, posted as JSON under `name`, which
 * `Zpn.json` on the schema side reads. The field is edited in more than one place of the form, so
 * it holds its value around them: put the form inside it and `EventVariantsFieldInput` once inside
 * the form, and edit the value with `useEventVariantsField`.
 */
export default function EventVariantsField({ name, defaultValue, children }: {
    name: string,
    defaultValue: EventVariantExpanded[],
    children: ReactNode,
}) {
    const [variants, setVariants] = useState(() => toVariantDrafts(defaultValue))

    return <EventVariantsFieldContext.Provider value={{ name, variants, setVariants }}>
        {children}
    </EventVariantsFieldContext.Provider>
}

/** What posts the field. */
export function EventVariantsFieldInput() {
    const { name, variants } = useField()
    return <input type="hidden" name={name} value={variantDraftsToField(variants)} />
}

/** The value of the field and how to change it, for the parts of the form that edit it. */
export function useEventVariantsField() {
    const { variants, setVariants } = useField()
    return {
        variants,
        setVariants,
        changeVariant: (key: number, changes: Partial<VariantDraft>) => setVariants(variants.map(variant => (
            variant.key === key ? { ...variant, ...changes } : variant
        ))),
    }
}
