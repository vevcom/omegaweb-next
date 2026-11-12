'use client'
import DateDisplay from '@/components/Date/Date'
import Form from '@/components/Form/Form'
import SearchableDropdown from '@/components/UI/SearchableDropdown'
import { configureAction } from '@/services/configureAction'
import { updateEventSeatingWishesAction } from '@/services/events/seating/actions'
import { MAX_WISHES } from '@/services/events/seating/plan'
import { useState } from 'react'
import type { OwnSeating } from '@/services/events/seating/types'

const NONE = 0

/** What a guest sees of the seating: their table once it is published, and until then who they wish for. */
export default function EventSeatingWishes({ eventId, seating }: { eventId: number, seating: OwnSeating }) {
    const [wishes, setWishes] = useState(
        Array.from({ length: MAX_WISHES }, (_, index) => seating.wishes[index] ?? NONE)
    )
    const chosen = wishes.filter(wish => wish !== NONE)
    const open = seating.wishesEnd !== null && new Date(seating.wishesEnd) > new Date()

    if (seating.table) {
        return <>
            <p className="m-0 text-l font-bold">Du sitter på bord {seating.table.number}</p>
            {seating.table.guests.length > 0 && <>
                <p className="m-0 text-base-content/80">Sammen med</p>
                <ul className="m-0 pl-5">
                    {seating.table.guests.map(name => <li key={name}>{name}</li>)}
                </ul>
            </>}
        </>
    }

    if (seating.published) {
        return <p className="m-0 text-base-content/80">Du har ikke fått et bord. Ta kontakt med arrangøren.</p>
    }

    if (!open) {
        const names = seating.wishes.flatMap(wish => seating.options.find(option => option.id === wish)?.name ?? [])
        return <>
            <p className="m-0 text-base-content/80">Bordplasseringen kommer her når den er klar.</p>
            {names.length > 0 && <p className="m-0">Du ønsket deg {names.join(', ')}.</p>}
        </>
    }

    return <Form
        action={configureAction(updateEventSeatingWishesAction, { params: { id: eventId } })}
        submitText="Lagre ønskene"
        className="flex flex-col gap-1"
    >
        <p className="m-0 text-base-content/80">
            Hvem vil du sitte med? Svar innen <DateDisplay date={seating.wishesEnd ?? new Date()} includeSeconds={false} />.
        </p>
        <input type="hidden" name="wishes" value={JSON.stringify(chosen)} />
        {wishes.map((wish, index) => <SearchableDropdown
            key={index}
            name={`wish${index}`}
            label={`Ønske ${index + 1}`}
            value={wish}
            options={[
                { value: NONE, label: 'Ingen' },
                ...seating.options
                    .filter(option => option.id === wish || !wishes.includes(option.id))
                    .map(option => ({ value: option.id, label: option.name })),
            ]}
            onChange={value => setWishes(wishes.map((other, position) => (position === index ? value : other)))}
        />)}
    </Form>
}
