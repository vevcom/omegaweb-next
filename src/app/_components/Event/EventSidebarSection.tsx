import type { ReactNode } from 'react'

/** One block of the sidebar of the event page: a card with a title and rows of information. */
export default function EventSidebarSection({ title, children }: { title: string, children: ReactNode }) {
    return <section className="
        flex flex-col gap-3 p-6 bg-surface-base rounded-round
        max-mobile:p-4
        [&>h2]:m-0 [&>h2]:pb-2 [&>h2]:border-b [&>h2]:border-surface-hover [&>h2]:text-l [&>h2]:font-bold
        [&>p]:m-0
    ">
        <h2>{title}</h2>
        {children}
    </section>
}
