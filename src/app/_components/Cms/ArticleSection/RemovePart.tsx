'use client'
import styles from './RemovePart.module.scss'
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
        <div ref={confirmRef} className={styles.RemovePart}>
            <button className={styles.openBtn} onClick={() => setConfirmOpen(x => !x)}>
                <FontAwesomeIcon icon={faX} />
            </button>
            {
                confirmOpen && (
                    <div className={styles.confirmation}>
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
