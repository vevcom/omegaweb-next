'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { createDynamicImageCollectionAction } from '@/services/images/dynamic/actions'
import { appHref } from '@/lib/sites/href'

export default function MakeNewCollection() {
    const popUpKey = 'MakeNewCollection'

    return (
        <AddHeaderItemPopUp popUpKey={popUpKey}>
            <div className="py-[2em] px-[7em] grid">
                <Form
                    closePopUpOnSuccess={popUpKey}
                    refreshOnSuccess
                    navigateOnSuccess={
                        collection => appHref(
                            collection ?
                                `/image-collections/dynamic/${encodeURIComponent(collection.name)}`
                                : '/image-collections'
                        )
                    }
                    title="Lag et album"
                    submitText="Lag album"
                    action={createDynamicImageCollectionAction}
                >
                    <TextInput label="Navn" name="collectionName" />
                    <TextInput label="Beskrivelse" name="collectionDescription" />
                    {/* The admin level is collected here rather than after the fact: a collection created with an
                      * empty one would be administrable by anyone until it was narrowed. */}
                    <div className="flex flex-col gap-[0.5em] min-w-[350px] mt-[1em]">
                        <h3>Hvem kan administrere albumet?</h3>
                        <VisibilityMatrixEditor name="visibilityAdminRequirements" verb="kan administrere albumet" />
                    </div>
                </Form>
            </div>
        </AddHeaderItemPopUp>
    )
}
