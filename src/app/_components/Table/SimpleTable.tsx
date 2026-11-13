
import SiteLink from '@/components/SiteLink/SiteLink'
import type { ReactNode } from 'react'
import type { AppHref } from '@/lib/sites/href'

export default function SimpleTable<T extends string[]>({
    header,
    body,
    links,
    className = 'ohma-table',
}: {
    header: T,
    body: { [K in keyof T]: ReactNode }[],
    links?: AppHref[],
    /** Replaces the default table style. */
    className?: string,
}) {
    return <table className={`
        ${className}
        [&_a]:no-underline [&_a]:text-inherit
    `}>
        <thead>
            <tr>
                {header.map((item, i) => <th key={i}>{item}</th>)}
            </tr>
        </thead>
        <tbody>
            {body.map((row, i) => <tr key={i}>
                {row.map((item, j) => <td key={j}>
                    {/* A row cannot sit inside a link, so every cell links on its own and only the first is a tab stop. */}
                    {links ? <SiteLink href={links[i]} tabIndex={j === 0 ? undefined : -1} className="block">
                        {item}
                    </SiteLink> : item}
                </td>)}
            </tr>)}
        </tbody>
    </table>
}
