import Link from 'next/link'

export type GroupTypeTableRow = {
    /** Stable react key - the group id is the natural choice. */
    key: string | number,
    name: string,
    order: number,
    members: number,
    /**
     * Where this group is administered. Left out for group types that have nowhere to go - a class,
     * for instance, is not administered per group.
     */
    href?: string,
    /**
     * Whether the group has been pensioned. A pensioned group is not waiting to be migrated, so it
     * is not flagged for being behind - it is simply done.
     */
    pensioned?: boolean,
}

type PropTypes = {
    rows: GroupTypeTableRow[],
    /**
     * The current omega order, so that a group left behind in an earlier one stands out.
     */
    currentOrder: number,
    nameHeading?: string,
    emptyText?: string,
}

/**
 * The shared listing of the groups of one group type: what it is called, which order it is in and
 * how many active members it has. Each group type's admin page supplies its own rows and decides
 * where a row links to, which is the only thing that differs between them.
 */
export default function GroupTypeTable({
    rows,
    currentOrder,
    nameHeading = 'Navn',
    emptyText = 'Ingen grupper',
}: PropTypes) {
    // Pensioned groups are finished with rather than pending, so they sit under the rest.
    const rowsPensionedLast = [...rows].sort(
        (one, two) => Number(one.pensioned ?? false) - Number(two.pensioned ?? false)
    )

    return (
        <table className="
            ohma-table
            [&_a]:text-accent-blue [&_a]:no-underline
            [&_a:hover]:underline
        ">
            <thead>
                <tr>
                    <th>{nameHeading}</th>
                    <th>Orden</th>
                    <th>Aktive medlemmer</th>
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 && (
                    <tr>
                        <td className="text-text-muted italic" colSpan={3}>{emptyText}</td>
                    </tr>
                )}
                {rowsPensionedLast.map(row => {
                    const behind = !row.pensioned && row.order < currentOrder
                    // A group behind the current omega order still has to be migrated, and says so rather
                    // than leaving the reader to work out what the colour means.
                    const status = behind ? 'text-accent-red font-bold' : 'text-accent-green'
                    const orderClass = row.pensioned ? '' : status

                    return (
                        <tr key={row.key}>
                            <th>{row.href ? <Link href={row.href}>{row.name}</Link> : row.name}</th>
                            <td className={row.pensioned ? 'text-text-muted' : ''}>
                                <span className={orderClass}>{row.order}</span>
                                {behind && (
                                    <span className="block mt-0.5 text-accent-red text-s">
                                        står i en tidligere orden og må migreres til orden {currentOrder}
                                    </span>
                                )}
                                {row.pensioned && <span className="block mt-0.5 text-accent-red text-s">pensjonert</span>}
                            </td>
                            <td>{row.members}</td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}
