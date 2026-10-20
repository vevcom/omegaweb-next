'use client'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import { EditModeContext } from '@/contexts/EditMode'
import { useContext } from 'react'

type PropTypes = {
    className?: string
}

/**
 * Wraps EditModeSwitch in the nav bar button it's shown in. EditModeSwitch renders null but would
 * still leave that button on the page, so this renders nothing at all when there's nothing on the
 * page the user is allowed to edit.
 */
export default function EditModeNavIcon({ className }: PropTypes) {
    const editModeCtx = useContext(EditModeContext)
    if (!editModeCtx?.somethingToEdit) return null

    return (
        <div className={className} title="Redigeringsmodus (Ctrl+Ø)">
            <EditModeSwitch />
        </div>
    )
}
