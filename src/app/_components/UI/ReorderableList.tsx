'use client'
import { Reorder, useDragControls } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGripVertical } from '@fortawesome/free-solid-svg-icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ActionReturn } from '@/services/actionTypes'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'

type ItemPropTypes<Item> = {
    item: Item,
    index: number,
    className?: string,
    style?: CSSProperties,
    onDragEnd: () => void,
    renderItem: (item: Item, extras: { handle: ReactNode, index: number }) => ReactNode,
}

function ReorderableItem<Item>({
    item,
    index,
    className,
    style,
    onDragEnd,
    renderItem,
}: ItemPropTypes<Item>) {
    const dragControls = useDragControls()

    const handle = (
        <span
            className="
                flex items-center justify-center size-6 rounded-[var(--gap)] text-text-muted cursor-grab touch-none
                select-none transition-colors duration-300
                hover:bg-surface-hover hover:text-ink-strong
                active:cursor-grabbing
            "
            aria-label="Dra for å flytte"
            onPointerDown={(event: PointerEvent) => dragControls.start(event)}
        >
            <FontAwesomeIcon icon={faGripVertical} />
        </span>
    )

    return (
        <Reorder.Item
            as="div"
            value={item}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={onDragEnd}
            whileDrag={{ scale: 1.01, boxShadow: '0 8px 20px rgba(0, 0, 0, 0.35)' }}
            className={`
                relative
                ${className ?? ''}
            `}
            style={style}
        >
            {renderItem(item, { handle, index })}
        </Reorder.Item>
    )
}

type PropTypes<Item> = {
    items: Item[],
    getId: (item: Item) => number,
    /** Stores the new order, given as every item's id from first to last. */
    saveOrder: (ids: number[]) => Promise<ActionReturn<unknown>>,
    /** Renders an item. Place `handle` where the item is dragged from. */
    renderItem: (item: Item, extras: { handle: ReactNode, index: number }) => ReactNode,
    className?: string,
    itemClassName?: string,
    itemStyle?: CSSProperties,
}

/**
 * A list reordered by dragging each item's handle, which saves the whole new order in one action
 * when an item is dropped.
 */
export default function ReorderableList<Item>({
    items,
    getId,
    saveOrder,
    renderItem,
    className,
    itemClassName,
    itemStyle,
}: PropTypes<Item>) {
    const [order, setOrder] = useState(items)
    const [prevItems, setPrevItems] = useState(items)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    if (prevItems !== items) {
        setPrevItems(items)
        setOrder(items)
    }

    const commitOrder = async () => {
        const ids = order.map(getId)
        if (ids.every((id, index) => id === getId(items[index]))) return

        const result = await saveOrder(ids)
        if (!result.success) {
            setOrder(items)
            setError(result.error?.map(issue => issue.message).join(' ') || 'Kunne ikke lagre rekkefølgen.')
            return
        }
        setError(null)
        router.refresh()
    }

    return (
        <>
            <Reorder.Group
                as="div"
                axis="y"
                values={order}
                onReorder={setOrder}
                className={className}
            >
                {order.map((item, index) => (
                    <ReorderableItem
                        key={getId(item)}
                        item={item}
                        index={index}
                        className={itemClassName}
                        style={itemStyle}
                        onDragEnd={commitOrder}
                        renderItem={renderItem}
                    />
                ))}
            </Reorder.Group>
            {error && <i className="text-accent-red">{error}</i>}
        </>
    )
}
