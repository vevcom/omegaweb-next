'use client'
import { increaseFlairRankAction, decreaseFlairRankAction } from '@/services/flairs/actions'
import { configureAction } from '@/services/configureAction'
import { flairAuth } from '@/services/flairs/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUpRightFromSquare, faGripVertical } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import type { PointerEvent, ReactNode } from 'react'

export type FlairRow = {
    id: number,
    image: ReactNode,
    name: string,
    colorStyle: { backgroundColor: string },
    editHref: string,
}

const columnClass = {
    colHandle: 'flex-[0_0_calc(4*var(--gap))]',
    colImage: `
        flex-[0_0_100px]
        max-mobile:basis-[72px] max-mobile:min-w-0
        max-mobile:[&>:first-child]:[zoom:0.72]
    `,
    colName: 'flex-[1_1_auto] min-w-0 wrap-anywhere',
    colColor: `
        flex-[0_0_100px] self-stretch
        max-mobile:basis-4
    `,
    colRank: `
        flex-[0_0_calc(6*var(--gap))]
        max-mobile:basis-6
    `,
    colLink: `
        flex-[0_0_140px]
        max-mobile:basis-6
    `,
}

type RowPropTypes = {
    row: FlairRow,
    index: number,
    canReorder: boolean,
    onDragEnd: (flairId: number) => void,
}

function FlairTableRow({ row, index, canReorder, onDragEnd }: RowPropTypes) {
    const dragControls = useDragControls()

    const startDrag = (event: PointerEvent) => dragControls.start(event)

    return (
        <Reorder.Item
            as="div"
            role="row"
            value={row}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={() => onDragEnd(row.id)}
            whileDrag={{ scale: 1.01, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)' }}
            className="
                relative flex items-center gap-2 bg-surface-raised py-3 px-4 transition-[background-color] duration-300
                even:bg-[color-mix(in_srgb,var(--surface-raised),white_3%)]
                hover:bg-surface-hover
            "
        >
            <span className={columnClass.colHandle} role="cell">
                {canReorder &&
                <span
                    className="
                        flex items-center justify-center size-6 rounded-[var(--gap)] text-text-muted cursor-grab
                        touch-none select-none transition-colors duration-300
                        hover:bg-surface-hover hover:text-ink-strong
                        active:cursor-grabbing
                    "
                    onPointerDown={startDrag}
                >
                    <FontAwesomeIcon icon={faGripVertical} />
                </span>
                }
            </span>
            <span className={columnClass.colImage} role="cell">{row.image}</span>
            <span className={columnClass.colName} role="cell">{row.name}</span>
            <span className={columnClass.colColor} role="cell" style={row.colorStyle}></span>
            <span className={columnClass.colRank} role="cell">{index + 1}</span>
            <span className={columnClass.colLink} role="cell">
                <Link href={row.editHref}>
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                    <span className="max-mobile:sr-only">Rediger</span>
                </Link>
            </span>
        </Reorder.Item>
    )
}

type PropTypes = {
    rows: FlairRow[],
}

export default function FlairTable({ rows }: PropTypes) {
    const [order, setOrder] = useState(rows)
    const [prevRows, setPrevRows] = useState(rows)
    const router = useRouter()
    const canIncreaseFlairRank = useAuthorizer({ authorizer: flairAuth.increaseRank }).authorized
    const canDecreaseFlairRank = useAuthorizer({ authorizer: flairAuth.decreaseRank }).authorized

    if (prevRows !== rows) {
        setPrevRows(rows)
        setOrder(rows)
    }

    const commitOrder = async (flairId: number) => {
        const originalIndex = rows.findIndex(row => row.id === flairId)
        const newIndex = order.findIndex(row => row.id === flairId)
        const steps = originalIndex - newIndex
        if (originalIndex === -1 || steps === 0) return

        const rankAction = steps > 0 ? increaseFlairRankAction : decreaseFlairRankAction
        for (let step = 0; step < Math.abs(steps); step++) {
            await configureAction(rankAction, { params: { flairId } })()
        }
        router.refresh()
    }

    return (
        <div
            className="
                w-full my-4 rounded-round overflow-hidden shadow-[var(--boxShadow)_0_1px_3px,var(--boxShadow)_0_1px_2px]
                text-m
                [&_a_svg]:mr-[0.5rem]
            "
            role="table"
        >
            <div className="flex items-center gap-2 bg-surface-raised text-ink-strong font-medium py-3 px-4" role="row">
                <span className={columnClass.colHandle} role="columnheader"></span>
                <span className={columnClass.colImage} role="columnheader">Bilde</span>
                <span className={columnClass.colName} role="columnheader">Navn</span>
                <span className={columnClass.colColor} role="columnheader">Farge</span>
                <span className={columnClass.colRank} role="columnheader">Rangering</span>
                <span className={columnClass.colLink} role="columnheader">Lenke</span>
            </div>
            <Reorder.Group
                as="div"
                axis="y"
                role="rowgroup"
                values={order}
                onReorder={setOrder}
                className="flex flex-col"
            >
                {order.map((row, index) => (
                    <FlairTableRow
                        key={row.id}
                        row={row}
                        index={index}
                        canReorder={canIncreaseFlairRank && canDecreaseFlairRank}
                        onDragEnd={commitOrder}
                    />
                ))}
            </Reorder.Group>
        </div>
    )
}
