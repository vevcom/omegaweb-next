import type { ReactNode } from 'react'

/** One block of an event's administration: a card on the tab it belongs to, under a title when it has one. */
export default function AdminSection({ title, children }: { title?: string, children: ReactNode }) {
    return <section className="
        flex flex-col gap-3 p-4 rounded-round bg-base-200
        [&>h3]:m-0 [&>h3]:text-l [&>h3]:font-bold
        [&>p]:m-0
    ">
        {title && <h3>{title}</h3>}
        {children}
    </section>
}
