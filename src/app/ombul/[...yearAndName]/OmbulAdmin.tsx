'use client'

import styles from './OmbulAdmin.module.scss'
import Form from '@/components/Form/Form'
import Textarea from '@/components/UI/Textarea'
import Image from '@/components/Image/Image'
import ImageUploader from '@/components/Image/ImageUploader'
import {
    updateOmbulAction,
    updateOmbulFileAction,
    destroyOmbulAction,
    updateOmbulCoverImageAction
} from '@/services/ombul/actions'
import NumberInput from '@/components/UI/NumberInput'
import FileInput from '@/components/UI/FileInput'
import useEditMode from '@/hooks/useEditMode'
import useAuthorizer from '@/hooks/useAuthorizer'
import { ombulAuth } from '@/services/ombul/auth'
import { configureAction } from '@/services/configureAction'
import { useRouter } from 'next/navigation'
import type { ExpandedOmbul } from '@/services/ombul/types'

type PropTypes = {
    ombul: ExpandedOmbul
}

/**
 * The admin panel for the ombul to change cover image and update year, number, description and file.
 * The component is only shown if editmode is enabled.
 * @param ombul - The obul (expanded) to be edited
 * @returns
 */
export default function OmbulAdmin({ ombul }: PropTypes) {
    const { push, refresh } = useRouter()
    const canUpdate = useEditMode({
        authorizer: ombulAuth.update
    })
    const canUpdateCoverAuthResult = useAuthorizer({
        authorizer: ombulAuth.updateCoverImage
    })
    const canUpdateCover = useEditMode({ authResult: canUpdateCoverAuthResult })
    const canDestroy = useEditMode({
        authorizer: ombulAuth.destroy
    })

    const updateOmbulActionBind = configureAction(
        updateOmbulAction,
        { params: { id: ombul.id } }
    )
    const updateOmbulFileActionBind = configureAction(
        updateOmbulFileAction,
        { params: { id: ombul.id } }
    )

    const handleChange = async (newOmbul: ExpandedOmbul | undefined) => {
        if (!newOmbul) return
        push(`/ombul/${newOmbul.year}/${newOmbul.name}`)
        refresh()
    }

    const handleDestroy = async () => {
        push('/ombul')
        refresh()
    }
    if (!canUpdate && !canDestroy && !canUpdateCover) return null

    return (
        <div className={styles.OmbulAdmin}>
            <h2>Admin</h2>
            <div className={styles.left}>
                {
                    canUpdate && (
                        <>
                            <Form
                                action={updateOmbulActionBind}
                                successCallback={handleChange}
                                submitText="Oppdater"
                            >
                                <NumberInput
                                    name="year"
                                    label="År"
                                    defaultValue={ombul.year}
                                />
                                <NumberInput
                                    name="issueNumber"
                                    label="Nummer"
                                    defaultValue={ombul.issueNumber}
                                />
                                <Textarea
                                    name="description"
                                    label="Beskrivelse"
                                    defaultValue={ombul.description ?? ''}
                                />
                            </Form>
                            <Form
                                action={updateOmbulFileActionBind}
                                successCallback={handleChange}
                                submitText="Oppdater fil"
                            >
                                <FileInput name="ombulFile" label="Ombul fil" color="primary" />
                            </Form>
                        </>
                    )
                }
                {
                    canDestroy && (
                        <Form
                            action={configureAction(
                                destroyOmbulAction,
                                { params: { id: ombul.id } }
                            )}
                            successCallback={handleDestroy}
                            submitText="Slett"
                            submitColor="red"
                            confirmation={{
                                confirm: true,
                                text: 'Sikker på at du vil slette ombul? Dette kan ikke angres.',
                            }}
                        ></Form>
                    )
                }
            </div>
            <div className={styles.right}>
                {
                    canUpdateCover && (
                        <div className={styles.coverImage}>
                            <Image image={ombul.coverImage} width={200} />
                            <ImageUploader
                                title="Endre forsidebilde"
                                refreshOnSuccess
                                uploadImageAction={configureAction(
                                    updateOmbulCoverImageAction,
                                    { params: { ombulId: ombul.id } }
                                )}
                            />
                        </div>
                    )
                }
            </div>
        </div>
    )
}
