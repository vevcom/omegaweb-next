'use client'
import styles from './CmsLinkEditor.module.scss'
import TextInput from '@/components/UI/TextInput'
import EditOverlay from '@/cms/EditOverlay'
import useEditMode from '@/hooks/useEditMode'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import { configureAction } from '@/services/configureAction'
import { useRouter } from 'next/navigation'
import type { CmsLink } from '@/prisma-generated-pn-types'
import type { UpdateCmsLinkAction } from '@/cms/links/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    cmsLink: CmsLink
    updateCmsLinkAction: UpdateCmsLinkAction
    capabilities: CapabilitiesJsObject<'canEdit'>
}

export default function CmsLinkEditor({ cmsLink, updateCmsLinkAction, capabilities }: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canEdit })
    const { refresh } = useRouter()

    if (!editable) return null
    return (
        <PopUp
            popUpKey={`EditCmsLink${cmsLink.id}`}
            showButtonClass={styles.openBtn}
            showButtonContent={
                <EditOverlay />
            }>
            <Form
                className={styles.CmsLinkEditor}
                action={
                    configureAction(
                        updateCmsLinkAction,
                        { params: { linkId: cmsLink.id } }
                    )
                }
                submitText="Endre lenke"
                successCallback={refresh}
            >
                <TextInput defaultValue={cmsLink.text} name="text" label="Tekst" />
                <TextInput defaultValue={cmsLink.url} name="url" label="URL" />
            </Form>
        </PopUp>

    )
}
