
import Link from 'next/link'
import type { ReactNode } from 'react'

export default function SimpleTable<T extends string[]>({
    header,
    body,
    links,
}: {
    header: T,
    body: { [K in keyof T]: ReactNode }[],
    links?: T,
}) {
    return <table className="ohma-table [&_a]:contents [&_a]:no-underline [&_a]:text-inherit">
        <thead>
            <tr>
                {header.map((item, i) => <th key={i}>{item}</th>)}
            </tr>
        </thead>
        <tbody>
            {links ? body.map((row, i) => <Link key={i} href={links[i]}>
                <tr>
                    {row.map((item, j) => <td key={j}>{item}</td>)}
                </tr>
            </Link>
            ) : body.map((row, i) => <tr key={i}>
                {row.map((item, j) => <td key={j}>{item}</td>)}
            </tr>)}
        </tbody>
    </table>
}
