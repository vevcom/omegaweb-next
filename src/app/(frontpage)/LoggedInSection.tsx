import React from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faInbox } from '@fortawesome/free-solid-svg-icons'

export default function LoggedInSection({
    title,
    link,
    layout = 'grid',
    span = 'full',
    emptyMessage = 'Ingenting å vise her enda',
    children,
}: {
    title: string,
    link: string,
    /** 'rows' stacks full-width children instead of laying them out as a card grid. */
    layout?: 'grid' | 'rows',
    /** How much of the island row this section claims once there is room for two. */
    span?: 'full' | 'half',
    /** Shown in place of the list when there are no children to display. */
    emptyMessage?: string,
    children: React.ReactNode,
}) {
    const isEmpty = React.Children.count(children) === 0

    // Each section is its own island, so the page background shows between them. Two half
    // islands share a row once there is room; below the mobile breakpoint they stack instead.
    const spanClass = span === 'half'
        ? 'flex-[1_1_calc(50%-var(--gap))] max-mobile:basis-full'
        : 'flex-[1_1_100%]'
    // The rows height is fixed so the half islands line up; the empty placeholder matches it.
    const layoutClass = layout === 'rows' ? 'row-list mb-0! h-76' : 'image-card-list'

    return <section className={`min-w-0 bg-surface-base rounded-round p-6 max-mobile:p-4 ${spanClass}`}>
        <div className={[
            'w-full flex justify-between items-center gap-4',
            '[&>h4]:text-xl [&>h4]:font-bold [&>h4]:font-secondary',
        ].join(' ')}>
            <h4>{title}</h4>
            {/* Matches the header-item pill (the "Ny +" button) so the two read as the same kind of control. */}
            <Link href={link} className={[
                'shrink-0 flex items-center h-10 px-4 rounded-inner bg-surface-hover text-ink-strong text-m font-medium',
                'whitespace-nowrap no-underline transition-colors duration-300',
                'hover:bg-surface-subtle hover:text-ink-strong hover:no-underline',
            ].join(' ')}>Se flere</Link>
        </div>
        <div className={`text-m mt-4 ${layoutClass}`}>
            {isEmpty
                ? <div className={[
                    'h-76 flex flex-col items-center justify-center gap-2 text-ink-hover text-center',
                    '[&>svg]:[font-size:calc(6*var(--gap))] [&>svg]:opacity-50',
                ].join(' ')}>
                    <FontAwesomeIcon icon={faInbox} />
                    <p>{emptyMessage}</p>
                </div>
                : children}
        </div>
    </section>
}
