'use client'

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
import { formatVevenUri } from '@/lib/urlEncoding'
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
    const canUpdate = useEditMode({
        authorizer: ombulAuth.update
    })
    const canUpdateCoverAuthResult = useAuthorizer({
        authorizer: ombulAuth.updateCoverImage
    })
    const canUpdateCover = useEditMode({ authResult: canUpdateCoverAuthResult })
    const canUpdateFile = useEditMode({
        authorizer: ombulAuth.updateFile
    })
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

    const ombulPath = (newOmbul?: ExpandedOmbul) => (
        newOmbul ? `/ombul/${newOmbul.year}/${formatVevenUri(newOmbul.name, newOmbul.id)}` : null
    )

    if (!canUpdate && !canUpdateFile && !canDestroy && !canUpdateCover) return null

    return (
        <div className={[
            // On the page's own surface, delineated by a rule - the inputs inside are surface-raised. Only the direct h2
            // is the panel heading; the forms inside bring their own h2 titles.
            'mt-8 p-6 border border-surface-subtle rounded-round flex flex-row flex-wrap items-start gap-8',
            '[&>h2]:flex-[1_1_100%] [&>h2]:text-m [&>h2]:font-medium [&>h2]:text-text-muted [&>h2]:uppercase',
            '[&>h2]:tracking-[0.08em]',
        ].join(' ')}>
            <h2>Admin</h2>
            <div className={[
                // A hairline between the three forms rather than a heavier rule.
                'flex-[0_1_auto] [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-surface-subtle',
                '[&>*:not(:last-child)]:pb-6 [&>*:not(:last-child)]:mb-6',
            ].join(' ')}>
                {
                    canUpdate && (
                        <Form
                            action={updateOmbulActionBind}
                            refreshOnSuccess
                            navigateOnSuccess={ombulPath}
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
                    )
                }
                {
                    canUpdateFile && (
                        <Form
                            action={updateOmbulFileActionBind}
                            refreshOnSuccess
                            navigateOnSuccess={ombulPath}
                            submitText="Oppdater fil"
                        >
                            <FileInput name="ombulFile" label="Ombul fil" color="primary" />
                        </Form>
                    )
                }
                {
                    canDestroy && (
                        <Form
                            action={configureAction(
                                destroyOmbulAction,
                                { params: { id: ombul.id } }
                            )}
                            refreshOnSuccess
                            navigateOnSuccess="/ombul"
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
            <div>
                {
                    canUpdateCover && (
                        <div className={[
                            'flex flex-wrap items-start gap-4',
                            '[&>*:first-child]:rounded-round [&>*:first-child]:overflow-hidden',
                        ].join(' ')}>
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
