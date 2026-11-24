'use client'
import NumberInput from '@/components/UI/NumberInput'
import { useDebounce } from '@/hooks/useDebounce'
import { readRevueGroupMembersAtOrderAction } from '@/services/revue/groups/actions'
import { useEffect, useState } from 'react'

type PropTypes = {
    revueGroupId: number,
    defaultOrder: number,
    /** Left out where a larger field posts the order itself. */
    name?: string,
    onOrderChange?: (order: number | null) => void,
}

type Preview = { key: string, members: { name: string, title: string }[] | null }

/**
 * The order a revue group is put in a revue at, with who its members in the revue would be at that order,
 * so an order chosen wrong shows before it is saved.
 */
export default function RevueGroupOrderField({ revueGroupId, defaultOrder, name, onOrderChange }: PropTypes) {
    const [previewOrder, setPreviewOrder] = useState<number | null>(defaultOrder)
    const [preview, setPreview] = useState<Preview | null>(null)
    const debouncedSetPreviewOrder = useDebounce(setPreviewOrder, 300)
    const key = `${revueGroupId}-${previewOrder}`

    useEffect(() => {
        if (previewOrder === null) return undefined
        let current = true
        void readRevueGroupMembersAtOrderAction({ params: { revueGroupId, order: previewOrder } }).then(result => {
            if (current) setPreview({ key, members: result.success ? result.data : null })
        })
        return () => {
            current = false
        }
    }, [key, revueGroupId, previewOrder])

    return <div className="flex flex-col gap-2">
        <NumberInput
            name={name}
            label="Orden"
            defaultValue={defaultOrder}
            onChange={event => {
                const order = orderOf(event.target.value)
                onOrderChange?.(order)
                debouncedSetPreviewOrder(order)
            }}
        />
        {previewOrder !== null && <MembersAtOrder order={previewOrder} preview={preview?.key === key ? preview : null} />}
    </div>
}

function MembersAtOrder({ order, preview }: { order: number, preview: Preview | null }) {
    if (!preview) return <p className="m-0 text-s text-base-content/80">Henter medlemmene i orden {order} …</p>
    if (!preview.members) return <p className="m-0 text-s text-error">Fant ikke medlemmene i orden {order}.</p>
    if (preview.members.length === 0) {
        return <p className="m-0 text-s text-base-content/80">Gruppen har ingen medlemmer i orden {order}.</p>
    }
    return <div className="flex flex-col gap-1 text-s">
        <span className="text-base-content/80">Medlemmene i revyen ved orden {order}:</span>
        <ul className="m-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-1">
            {preview.members.map((member, index) => <li key={index}>
                {member.name}
                <span className="text-base-content/80"> · {member.title}</span>
            </li>)}
        </ul>
    </div>
}

function orderOf(value: string) {
    const order = Number(value)
    return value.trim() && Number.isInteger(order) ? order : null
}
