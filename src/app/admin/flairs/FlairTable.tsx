'use client'
import styles from './page.module.scss'
import { increaseFlairRankAction, decreaseFlairRankAction } from '@/services/flairs/actions'
import { configureAction } from '@/services/configureAction'
import { flairAuth } from '@/services/flairs/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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
            className={styles.row}
        >
            <span className={styles.colHandle} role="cell">
                {canReorder &&
                <span className={styles.dragHandle} onPointerDown={startDrag}>
                    <FontAwesomeIcon icon={faGripVertical} />
                </span>
                }
            </span>
            <span className={styles.colImage} role="cell">{row.image}</span>
            <span className={styles.colName} role="cell">{row.name}</span>
            <span className={styles.colColor} role="cell" style={row.colorStyle}></span>
            <span className={styles.colRank} role="cell">{index + 1}</span>
            <span className={styles.colLink} role="cell">
                <Link className={styles.imageContainer} href={row.editHref}>
                    <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                    <span className={styles.linkText}>Rediger</span>
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
    const router = useRouter()
    const canIncreaseFlairRank = useAuthorizer({ authorizer: flairAuth.increaseRank }).authorized
    const canDecreaseFlairRank = useAuthorizer({ authorizer: flairAuth.decreaseRank }).authorized

    useEffect(() => {
        setOrder(rows)
    }, [rows])

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
        <div className={styles.flairList} role="table">
            <div className={styles.headerRow} role="row">
                <span className={styles.colHandle} role="columnheader"></span>
                <span className={styles.colImage} role="columnheader">Bilde</span>
                <span className={styles.colName} role="columnheader">Navn</span>
                <span className={styles.colColor} role="columnheader">Farge</span>
                <span className={styles.colRank} role="columnheader">Rank</span>
                <span className={styles.colLink} role="columnheader">Link</span>
            </div>
            <Reorder.Group
                as="div"
                axis="y"
                role="rowgroup"
                values={order}
                onReorder={setOrder}
                className={styles.body}
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
