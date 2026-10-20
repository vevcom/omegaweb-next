'use client'
import styles from './MakeNewCollection.module.scss'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { createDynamicImageCollectionAction } from '@/services/images/dynamic/actions'
import { useState } from 'react'
import type { VisibilityRequirement } from '@/services/visibility/types'

export default function MakeNewCollection() {
    const popUpKey = 'MakeNewCollection'
    const [adminRequirements, setAdminRequirements] = useState<VisibilityRequirement[]>([])

    // The admin level is collected here rather than after the fact: a collection created with an
    // empty one would be administrable by anyone until it was narrowed.
    async function handleCreate(formData: FormData) {
        const collectionName = formData.get('collectionName')
        const collectionDescription = formData.get('collectionDescription')
        return createDynamicImageCollectionAction({
            data: {
                collectionName: typeof collectionName === 'string' ? collectionName : '',
                collectionDescription: typeof collectionDescription === 'string' ? collectionDescription : '',
                visibilityAdminRequirements: adminRequirements,
            }
        })
    }

    return (
        <AddHeaderItemPopUp popUpKey={popUpKey}>
            <div className={styles.MakeNewCollection}>
                <Form
                    closePopUpOnSuccess={popUpKey}
                    refreshOnSuccess
                    navigateOnSuccess={
                        collection =>
                            (
                                collection ?
                                    `/image-collections/dynamic/${encodeURIComponent(collection.name)}`
                                    : '/image-collections'
                            )
                    }
                    title="Lag et album"
                    submitText="Lag album"
                    action={handleCreate}
                >
                    <TextInput label="Navn" name="collectionName" />
                    <TextInput label="Beskrivelse" name="collectionDescription" />
                    <div className={styles.visibility}>
                        <h3>Hvem kan administrere albumet?</h3>
                        <VisibilityMatrixEditor
                            requirements={adminRequirements}
                            onChange={setAdminRequirements}
                        />
                    </div>
                </Form>
            </div>
        </AddHeaderItemPopUp>
    )
}
