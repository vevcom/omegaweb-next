'use client'
import styles from './CollectionAdmin.module.scss'
import CollectionAdminUpload from './CollectionAdminUpload'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import ImageUploader from '@/components/Image/ImageUploader'
import {
    SettingsHeaderItemPopUp,
    UploadHeaderItemPopUp,
    VisibilityHeaderItemPopUp,
} from '@/components/HeaderItems/HeaderItemPopUp'
import VisibilityAdmin from '@/components/Visibility/VisibilityAdmin/VisibilityAdmin'
import useEditMode from '@/hooks/useEditMode'
import { dynamicImageAuth } from '@/services/images/dynamic/auth'
import Button from '@/components/UI/Button'
import { configureAction } from '@/services/configureAction'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import {
    updateDynamicImageCollectionAction,
    destroyDynamicImageCollectionAction,
    uploadImageToDynamicCollectionAction,
    updateDynamicImageCollectionRegularLevelVisibilityAction,
    updateDynamicImageCollectionAdminLevelVisibilityAction,
} from '@/services/images/dynamic/actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { ExpandedImageCollection } from '@/services/images/subservice/types'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

type PropTypes = {
    collection: ExpandedImageCollection,
    doubleLevelVisibility: DoubleLevelVisibilityMatrix | null,
    refreshImages: () => void,
}

export default function CollectionAdmin({ collection, doubleLevelVisibility, refreshImages }: PropTypes) {
    const { id: collectionId } = collection
    const router = useRouter()
    const doubleLevelMatrix = doubleLevelVisibility ?? EMPTY_VISIBILITY

    const canUploadOne = useEditMode({
        authorizer: dynamicImageAuth.uploadImage.data({ visibility: doubleLevelMatrix })
    })
    const canUploadMany = useEditMode({
        authorizer: dynamicImageAuth.uploadManyImages.data({ visibility: doubleLevelMatrix })
    })
    const canUpdateCollection = useEditMode({
        authorizer: dynamicImageAuth.updateCollection.data({ visibility: doubleLevelMatrix })
    })
    const canDestroyCollection = useEditMode({
        authorizer: dynamicImageAuth.destroyCollection.data({ visibility: doubleLevelMatrix })
    })
    const canUpdateRegularVisibility = useEditMode({
        authorizer: dynamicImageAuth.updateRegularLevel.data({ visibility: doubleLevelMatrix })
    })
    const canUpdateAdminVisibility = useEditMode({
        authorizer: dynamicImageAuth.updateAdminLevel.data({ visibility: doubleLevelMatrix })
    })

    const [uploadOption, setUploadOption] = useState<'MANY' | 'ONE'>(canUploadMany ? 'MANY' : 'ONE')

    const canUpload = canUploadOne || canUploadMany
    const canOpenEditPopUp = canUpdateCollection || canDestroyCollection
    const canOpenVisibilityPopUp = canUpdateRegularVisibility || canUpdateAdminVisibility

    if (!canUpload && !canOpenEditPopUp && !canOpenVisibilityPopUp) return null

    return (
        <div className={styles.CollectionAdmin}>
            {
                canUpload && (
                    <UploadHeaderItemPopUp popUpKey="UploadImages">
                        <div className={styles.upload}>
                            {
                                uploadOption === 'MANY' ? canUploadMany && (
                                    <CollectionAdminUpload
                                        collectionId={collectionId}
                                        refreshImages={refreshImages}
                                    />
                                ) : canUploadOne && (
                                    <ImageUploader
                                        title="Last opp bilde"
                                        successCallback={refreshImages}
                                        closePopUpOnSuccess="UploadImages"
                                        uploadImageAction={configureAction(
                                            uploadImageToDynamicCollectionAction,
                                            { params: { collectionId } }
                                        )}
                                    />
                                )
                            }
                            {
                                canUploadOne && canUploadMany && (
                                    <Button
                                        className={styles.toggleUpload}
                                        onClick={() =>
                                            setUploadOption(uploadOption === 'MANY' ? 'ONE' : 'MANY')}
                                        color="secondary"
                                    >
                                        {uploadOption === 'MANY' ? 'Last opp ett bilde' : 'Last opp mange'}
                                    </Button>
                                )
                            }
                        </div>
                    </UploadHeaderItemPopUp>
                )
            }
            {
                // The settings variant defaults to a smaller button than the other two, so it is
                // matched to them explicitly.
                canOpenEditPopUp && (
                    <SettingsHeaderItemPopUp scale={40} popUpKey="Edit">
                        {
                            canUpdateCollection && (
                                <Form
                                    refreshOnSuccess
                                    title="Rediger samling"
                                    submitText="Oppdater"
                                    closePopUpOnSuccess="Edit"
                                    action={configureAction(
                                        updateDynamicImageCollectionAction,
                                        { params: { collectionId } }
                                    )}
                                >
                                    <TextInput
                                        defaultValue={collection.name}
                                        color="black"
                                        label="Navn"
                                        name="collectionName"
                                    />
                                    <TextInput
                                        defaultValue={collection.description || ''}
                                        color="black"
                                        label="Beskrivelse"
                                        name="collectionDescription"
                                    />
                                </Form>
                            )
                        }
                        {
                            canDestroyCollection && (
                                <Form
                                    submitText="Slett samling"
                                    successCallback={() => router.push('/image-collections')}
                                    action={configureAction(
                                        destroyDynamicImageCollectionAction,
                                        { params: { collectionId } }
                                    )}
                                    submitColor="red"
                                    confirmation={{
                                        confirm: true,
                                        text:
                                            'Er du sikker på at du vil slette samlingen. ' +
                                            'Dette vil også slette alle bilder i salingen.'
                                    }}
                                />
                            )
                        }
                    </SettingsHeaderItemPopUp>
                )
            }
            {
                doubleLevelVisibility && canOpenVisibilityPopUp && (
                    <VisibilityHeaderItemPopUp popUpKey="Visibility">
                        <div className={styles.visibility}>
                            {
                                canUpdateRegularVisibility && (
                                    <div>
                                        <h3>Vanlig visning</h3>
                                        <VisibilityAdmin
                                            visibility={doubleLevelVisibility.regularLevel}
                                            visibilityId={collection.visibilityRegularId}
                                            updateVisibilityAction={configureAction(
                                                updateDynamicImageCollectionRegularLevelVisibilityAction,
                                                { implementationParams: { collectionId } }
                                            )}
                                        />
                                    </div>
                                )
                            }
                            {
                                canUpdateAdminVisibility && (
                                    <div>
                                        <h3>Adminvisning</h3>
                                        <VisibilityAdmin
                                            visibility={doubleLevelVisibility.adminLevel}
                                            visibilityId={collection.visibilityAdminId}
                                            updateVisibilityAction={configureAction(
                                                updateDynamicImageCollectionAdminLevelVisibilityAction,
                                                { implementationParams: { collectionId } }
                                            )}
                                        />
                                    </div>
                                )
                            }
                        </div>
                    </VisibilityHeaderItemPopUp>
                )
            }
        </div>
    )
}
