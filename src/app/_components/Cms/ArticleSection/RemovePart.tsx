'use client'
import useEditMode from '@/hooks/useEditMode'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import useSiteRouter from '@/hooks/useSiteRouter'
import { useState } from 'react'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ArticleSectionPart, RemovePartFromArticleSectionAction } from '@/cms/articleSections/types'
import type { ConfiguredAction } from '@/services/actionTypes'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    part: ArticleSectionPart,
    removePartFromArticleSectionAction: ConfiguredAction<RemovePartFromArticleSectionAction>
    capabilities: CapabilitiesJsObject<'canEdit'>
}

/** Removes a part of a section. The first click asks, on the button itself, and the second removes. */
export default function RemovePart({ part, removePartFromArticleSectionAction, capabilities }: PropTypes) {
    const { refresh } = useSiteRouter()
    const editable = useEditMode({ authResult: capabilities.canEdit })
    const [state, setState] = useState<'idle' | 'confirming' | 'removing' | 'failed'>('idle')
    const ref = useClickOutsideRef(() => setState('idle'))

    if (!editable) return null

    const handleClick = async () => {
        if (state !== 'confirming') {
            setState('confirming')
            return
        }
        setState('removing')
        const result = await removePartFromArticleSectionAction({ data: { part } })
        if (!result.success) {
            setState('failed')
            return
        }
        refresh()
    }
    const asking = state !== 'idle'

    return (
        <div ref={ref}>
            <button
                type="button"
                title="Fjern"
                aria-label={asking ? 'Bekreft fjerning' : 'Fjern'}
                disabled={state === 'removing'}
                onClick={handleClick}
                className={`
                    h-8 rounded-inner border-none flex items-center gap-1 cursor-pointer text-s whitespace-nowrap
                    ${asking ? 'px-2 bg-error text-error-content' : `
                        w-8 justify-center bg-base-200 text-error
                        hover:bg-base-300
                    `}
                `}
            >
                <FontAwesomeIcon icon={faTrash} />
                {state === 'confirming' && 'Fjern?'}
                {state === 'removing' && 'Fjerner...'}
                {state === 'failed' && 'Kunne ikke fjerne'}
            </button>
        </div>
    )
}
