import type { ReactNode } from 'react'

/** One block of the event page: a card with a title and rows of information. */
export default function EventSection({ title, children }: { title: string, children: ReactNode }) {
    return <section className="
        flex flex-col gap-3 p-6 bg-base-100 rounded-round
        max-mobile:p-4
        [&>h2]:m-0 [&>h2]:pb-2 [&>h2]:border-b [&>h2]:border-base-300 [&>h2]:text-l [&>h2]:font-bold
        [&>p]:m-0
        [&_p:empty]:hidden
    ">
        <h2>{title}</h2>
        {children}
    </section>
}

/** A part of an EventSection under a heading of its own, with a line between it and what is above. */
export function EventSubSection({ title, children }: { title: string, children: ReactNode }) {
    return <section className="
        flex flex-col gap-3 pt-3 border-t border-base-300
        [&>h3]:m-0 [&>h3]:text-l [&>h3]:font-bold
    ">
        <h3>{title}</h3>
        {children}
    </section>
}
