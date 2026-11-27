'use client'
import { toVariantDrafts, variantsToPost } from '@/services/events/setupDraft'
import JsonFieldInput from '@/components/Form/JsonFieldInput'
import { createContext, useContext, useState } from 'react'
import type { VariantDraft } from '@/services/events/setupDraft'
import type { EventVariantExpanded } from '@/services/events/variants/types'
import type { SlotOnBoard } from '@/services/events/slots/types'
import type { ReactNode } from 'react'

type EventVariantsFieldContextType = {
    name: string,
    variants: VariantDraft[],
    setVariants: (variants: VariantDraft[]) => void,
    reset: () => void,
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
export default function EventVariantsField({ name, defaultValue, savedSlots, savedWaiting, children }: {
    name: string,
    defaultValue: EventVariantExpanded[],
    /** The slots of each slotted variant by its id, with who holds them, when they could be read. */
    savedSlots: Record<number, SlotOnBoard[]>,
    /** Who waits for a slot on each slotted variant by its id. */
    savedWaiting: Record<number, number[]>,
    children: ReactNode,
}) {
    const [variants, setVariants] = useState(() => toVariantDrafts(defaultValue, savedSlots, savedWaiting))
    // A refresh of the page brings who holds the slots now and who waits, such as after registering
    // someone in another tab, so that those placed or removed are the ones registered when it is saved.
    const [boardGiven, setBoardGiven] = useState({ savedSlots, savedWaiting })
    if (boardGiven.savedSlots !== savedSlots || boardGiven.savedWaiting !== savedWaiting) {
        setBoardGiven({ savedSlots, savedWaiting })
        setVariants(variants.map(variant => (variant.id === undefined ? variant : {
            ...variant,
            savedSlots: savedSlots[variant.id] ?? [],
            savedWaiting: savedWaiting[variant.id] ?? [],
        })))
    }

    const reset = () => setVariants(toVariantDrafts(defaultValue, savedSlots, savedWaiting))

    return <EventVariantsFieldContext.Provider value={{ name, variants, setVariants, reset }}>
        {children}
    </EventVariantsFieldContext.Provider>
}

/** What posts the field, and puts it back to the value it started with when the form is reset. */
export function EventVariantsFieldInput() {
    const { name, variants, reset } = useField()
    return <JsonFieldInput name={name} value={variantsToPost(variants)} onReset={reset} />
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
