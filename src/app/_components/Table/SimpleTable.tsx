import RowLink from './RowLink'
import type { ReactNode } from 'react'
import type { AppHref } from '@/lib/sites/href'

export default function SimpleTable<T extends string[]>({
    header,
    body,
    links,
}: {
    header: T,
    body: { [K in keyof T]: ReactNode }[],
    links?: AppHref[],
}) {
    return <table className="ohma-table">
        <thead>
            <tr>
                {header.map((item, i) => <th key={i}>{item}</th>)}
            </tr>
        </thead>
        <tbody>
            {body.map((row, i) => <tr key={i} className={links ? 'relative' : undefined}>
                {row.map((item, j) => <td key={j}>
                    {links && j === 0 ? <RowLink href={links[i]}>{item}</RowLink> : item}
                </td>)}
            </tr>)}
        </tbody>
    </table>
}
