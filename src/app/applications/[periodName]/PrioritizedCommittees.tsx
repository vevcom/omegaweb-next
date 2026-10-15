'use client'
import { committeeCardBodyClassName, committeeCardClassName } from './committeeCardClassNames'
import { updateApplicationAction } from '@/services/applications/actions'
import { applicationAuth } from '@/services/applications/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import { Reorder, useDragControls } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGripVertical } from '@fortawesome/free-solid-svg-icons'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PointerEvent, ReactNode } from 'react'

export type PrioritizedCommittee = {
    /** The id of the committee's participation in this period - what an application points at. */
    committeeParticipationId: number,
    card: ReactNode,
}

type ItemPropTypes = {
    item: PrioritizedCommittee,
    priority: number,
    canReorder: boolean,
    onDragEnd: (committeeParticipationId: number) => void,
}

function PrioritizedCommittee({ item, priority, canReorder, onDragEnd }: ItemPropTypes) {
    const dragControls = useDragControls()

    const startDrag = (event: PointerEvent) => dragControls.start(event)

    return (
        <Reorder.Item
            as="div"
            value={item}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={() => onDragEnd(item.committeeParticipationId)}
            whileDrag={{ scale: 1.01, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)' }}
            className={`${committeeCardClassName} relative`}
        >
            <div className="flex-[0_0_auto] w-[3em] flex flex-col items-center gap-[0.5em]">
                {/* The priority comes from the position in the list rather than from the server
                    so that the numbers follow along while the card is being dragged. */}
                <span className={[
                    'shrink-0 rounded-full bg-accent-blue text-text-inv',
                    'size-[3em] grid place-items-center font-bold',
                ].join(' ')}>{priority}</span>
                {canReorder && (
                    <span className={[
                        // Same handle as the flair admin table, so reordering works the same way in both places.
                        'flex items-center justify-center size-6 rounded-[var(--gap)] text-text-muted cursor-grab',
                        'touch-none select-none',
                        'transition-colors duration-300 hover:bg-surface-hover hover:text-ink-strong active:cursor-grabbing',
                    ].join(' ')} onPointerDown={startDrag}>
                        <FontAwesomeIcon icon={faGripVertical} />
                    </span>
                )}
            </div>
            <div className={committeeCardBodyClassName}>
                {item.card}
            </div>
        </Reorder.Item>
    )
}

type PropTypes = {
    items: PrioritizedCommittee[],
    userId: number,
}

/**
 * The committees the user has applied to, ordered by priority and reorderable by dragging the
 * handle - the same interaction as the flair admin table.
 * @param items - The applied-to committees in priority order, with their rendered cards
 * @param userId - The user whose priorities are being reordered
 */
export default function PrioritizedCommittees({ items, userId }: PropTypes) {
    const [order, setOrder] = useState(items)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const canReorder = useAuthorizer({ authorizer: applicationAuth.update.data({ userId }) }).authorized

    useEffect(() => {
        setOrder(items)
    }, [items])

    const handleShowError = useCallback((message: string) => {
        setError(message)
        setTimeout(() => setError(null), 3000)
    }, [])

    const commitOrder = useCallback(async (committeeParticipationId: number) => {
        const originalIndex = items.findIndex(
            item => item.committeeParticipationId === committeeParticipationId
        )
        const newIndex = order.findIndex(
            item => item.committeeParticipationId === committeeParticipationId
        )
        const steps = originalIndex - newIndex
        if (originalIndex === -1 || steps === 0) return

        // The action only swaps an application with its neighbour, so a drag across several
        // positions is committed one step at a time - the same as the flair rank actions.
        const direction = steps > 0 ? 'UP' : 'DOWN'
        for (let step = 0; step < Math.abs(steps); step++) {
            const res = await updateApplicationAction(
                { params: { userId, committeeParticipationId } },
                { data: { priority: direction } }
            )
            if (!res.success) {
                handleShowError(
                    res.error?.length ?
                        res.error.map(issue => issue.message).join(' ') :
                        'Noe gikk galt under omprioriteringen.'
                )
                break
            }
        }
        // Also on failure, so that a partially applied drag falls back to the stored order.
        router.refresh()
    }, [items, order, userId, router, handleShowError])

    return (
        <>
            <Reorder.Group
                as="div"
                axis="y"
                values={order}
                onReorder={setOrder}
                className="flex flex-col gap-2"
            >
                {order.map((item, index) => (
                    <PrioritizedCommittee
                        key={item.committeeParticipationId}
                        item={item}
                        priority={index + 1}
                        canReorder={canReorder}
                        onDragEnd={commitOrder}
                    />
                ))}
            </Reorder.Group>
            {error && <i className="text-accent-red">{error}</i>}
        </>
    )
}
