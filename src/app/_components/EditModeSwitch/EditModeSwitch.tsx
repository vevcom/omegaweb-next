'use client'
import { EditModeContext } from '@/contexts/EditMode'
import useKeyPress from '@/hooks/useKeyPress'
import { useContext, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import type { ChangeEvent } from 'react'

export default function EditModeSwitch() {
    const editingContext = useContext(EditModeContext)
    if (!editingContext) throw new Error('Fant ikke EditModeContext')

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        editingContext.setEditMode(e.target.checked)
    }

    const ref = useRef<HTMLInputElement>(null)

    useKeyPress('ø', (event:KeyboardEvent) => {
        if (event.ctrlKey) {
            editingContext.setEditMode(!editingContext.editMode)
        }
    })

    useEffect(() => {
        if (ref.current?.checked) {
            ref.current.checked = editingContext.editMode
        }
    })
    if (!editingContext.somethingToEdit) return null


    return (
        <div className="size-full">
            <label className="group/switch cursor-pointer flex items-center justify-center size-full p-2 box-border">
                <input
                    ref={ref}
                    checked={editingContext.editMode}
                    type="checkbox"
                    onChange={handleChange}
                    className="hidden peer"
                />
                <FontAwesomeIcon className="
                    size-[var(--edit-mode-icon-size,20px)] text-text transition-all duration-200
                    [&_path]:text-inherit
                    peer-checked:text-accent-blue
                    group-hover/switch:peer-not-checked:text-[color-mix(in_srgb,var(--accent-blue),var(--text))]
                " icon={faPencil} />
            </label>
        </div>
    )
}
