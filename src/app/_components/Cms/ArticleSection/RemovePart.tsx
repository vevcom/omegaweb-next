'use client'
import Form from '@/components/Form/Form'
import useEditMode from '@/hooks/useEditMode'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { ArticleSectionPart, RemovePartFromArticleSectionAction } from '@/cms/articleSections/types'
import type { ConfiguredAction } from '@/services/actionTypes'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    part: ArticleSectionPart,
    removePartFromArticleSectionAction: ConfiguredAction<RemovePartFromArticleSectionAction>
    capabilities: CapabilitiesJsObject<'canEdit'>
}

export default function RemovePart({ part, removePartFromArticleSectionAction, capabilities }: PropTypes) {
    const { refresh } = useRouter()
    const editable = useEditMode({ authResult: capabilities.canEdit })
    const [confirmOpen, setConfirmOpen] = useState(false)
    const confirmRef = useClickOutsideRef(() => setConfirmOpen(false))
    const handleRemove = removePartFromArticleSectionAction.bind(null, { data: { part } })

    if (!editable) return null
    return (
        <div ref={confirmRef} className="relative">
            <button
                className={[
                    'bg-[red] w-[30px] h-[30px] rounded-full border-none grid place-items-center',
                    'transition-colors duration-300 hover:bg-[hsl(0,100%,40%)] hover:cursor-pointer',
                ].join(' ')}
                onClick={() => setConfirmOpen(x => !x)}>
                <FontAwesomeIcon icon={faX} />
            </button>
            {
                confirmOpen && (
                    <div
                        className={[
                            'shadow-[0_0_10px_0_var(--boxShadow)] absolute top-full left-1/2 -translate-x-1/2 w-[200px]',
                            'bg-surface-raised round grid place-items-center [&_form]:w-auto [&_form]:h-auto',
                        ].join(' ')}
                    >
                        <Form
                            action={handleRemove}
                            submitText="Fjern"
                            successCallback={() => {
                                refresh()
                            }}
                            submitColor="red"
                        />
                    </div>
                )
            }
        </div>
    )
}
