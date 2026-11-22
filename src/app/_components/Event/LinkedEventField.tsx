'use client'
import Button from '@/components/UI/Button'
import PickedValue from '@/components/UI/PickedValue'
import PopUp from '@/components/PopUp/PopUp'
import { useFormReset, useInputEvent } from '@/components/Form/JsonFieldInput'
import { PopUpContext } from '@/contexts/PopUp'
import { displayDate } from '@/lib/dates/displayDate'
import { createContext, useContext, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { LinkableEvent, LinkedEvent } from '@/services/events/types'

type Selected = Pick<LinkedEvent, 'id' | 'name'> | null

type LinkedEventSelection = {
    startedWith: Selected,
    selected: Selected,
    setSelected: (event: Selected) => void,
}

const LinkedEventSelectionContext = createContext<LinkedEventSelection | null>(null)

/**
 * Holds the event picked to link to. It goes around the pop-up provider the list is shown in, since
 * the pop-up is rendered there and not where it is opened.
 */
export function LinkedEventSelectionProvider({ linked, children }: { linked: LinkedEvent | null, children: ReactNode }) {
    const [selected, setSelected] = useState<Selected>(linked)
    return <LinkedEventSelectionContext.Provider value={{ startedWith: linked, selected, setSelected }}>
        {children}
    </LinkedEventSelectionContext.Provider>
}

/**
 * The event picked to link to, as a field of a form that posts it as `companyPresentationId`, or
 * 'NULL' for none. It posts nothing until it is changed, so that a link the viewer may not see,
 * which they are shown as none, is kept.
 */
export default function LinkedEventField({ name, linkable }: {
    /** What an event of the kind linked to is called. */
    name: string,
    /** The events that may be picked: those the viewer administrates with nothing linked to them yet. */
    linkable: LinkableEvent[],
}) {
    const selection = useContext(LinkedEventSelectionContext)
    if (!selection) throw new Error('LinkedEventSelectionProvider mangler')
    const { startedWith, selected, setSelected } = selection
    const popUpKey = useId()
    const popUps = useContext(PopUpContext)
    const value = selected ? String(selected.id) : 'NULL'
    const inputRef = useRef<HTMLInputElement>(null)
    useInputEvent(inputRef, value)
    useFormReset(inputRef, () => setSelected(startedWith))

    const pick = (event: Selected) => {
        setSelected(event)
        popUps?.remove(popUpKey)
    }

    return <PickedValue
        label={name}
        value={selected?.name ?? null}
        empty="Ingen"
        actions={<>
            <PopUp
                popUpKey={popUpKey}
                customShowButton={open => (
                    <Button type="button" variant="text" onClick={open}>{selected ? 'Bytt' : 'Velg'}</Button>
                )}
            >
                <div className="flex flex-col gap-2 w-[min(80vw,40rem)] max-h-[70svh] overflow-y-auto">
                    <h3 className="m-0">Velg {name.toLowerCase()}</h3>
                    {linkable.length === 0 && <p className="m-0 text-base-content/80">
                        Ingen kommende du administrerer er ledige.
                    </p>}
                    {linkable.map(event => <Button
                        key={event.id}
                        type="button"
                        variant="text"
                        className="flex flex-col items-start text-left"
                        onClick={() => pick(event)}
                    >
                        <span>{event.name}</span>
                        <span className="text-s text-base-content/80">
                            {[
                                displayDate(event.eventStart, false),
                                event.company?.name,
                                event.published ? null : 'utkast',
                            ].filter(Boolean).join(', ')}
                        </span>
                    </Button>)}
                </div>
            </PopUp>
            {selected && <Button type="button" variant="text" onClick={() => setSelected(null)}>Fjern</Button>}
        </>}
    >
        <input
            ref={inputRef}
            name="companyPresentationId"
            type="hidden"
            value={value}
            disabled={selected?.id === startedWith?.id}
        />
    </PickedValue>
}
