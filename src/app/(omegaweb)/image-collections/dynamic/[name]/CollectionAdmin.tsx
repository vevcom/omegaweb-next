'use client'
import { imageCollectionVisibility } from '@/app/(omegaweb)/image-collections/imageCollectionVisibility'
import CollectionAdminUpload from './CollectionAdminUpload'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import ImageUploader from '@/components/Image/ImageUploader'
import {
    SettingsHeaderItemPopUp,
    UploadHeaderItemPopUp,
    VisibilityHeaderItemPopUp,
} from '@/components/HeaderItems/HeaderItemPopUp'
import useAuthorizer from '@/hooks/useAuthorizer'
import { dynamicImageAuth } from '@/services/images/dynamic/auth'
import Button from '@/components/UI/Button'
import { configureAction } from '@/services/configureAction'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import {
    updateDynamicImageCollectionAction,
    destroyDynamicImageCollectionAction,
    uploadImageToDynamicCollectionAction,
} from '@/services/images/dynamic/actions'
import useSiteRouter from '@/hooks/useSiteRouter'
import { appHref } from '@/lib/sites/href'
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
    const router = useSiteRouter()
    const doubleLevelMatrix = doubleLevelVisibility ?? EMPTY_VISIBILITY

    const canUploadOne = useAuthorizer({
        authorizer: dynamicImageAuth.uploadImage.data({ visibility: doubleLevelMatrix })
    }).authorized
    const canUploadMany = useAuthorizer({
        authorizer: dynamicImageAuth.uploadManyImages.data({ visibility: doubleLevelMatrix })
    }).authorized
    const canUpdateCollection = useAuthorizer({
        authorizer: dynamicImageAuth.updateCollection.data({ visibility: doubleLevelMatrix })
    }).authorized
    const canDestroyCollection = useAuthorizer({
        authorizer: dynamicImageAuth.destroyCollection.data({ visibility: doubleLevelMatrix })
    }).authorized
    const canUpdateRegularVisibility = useAuthorizer({
        authorizer: dynamicImageAuth.updateRegularLevel.data({ visibility: doubleLevelMatrix })
    }).authorized
    const canUpdateAdminVisibility = useAuthorizer({
        authorizer: dynamicImageAuth.updateAdminLevel.data({ visibility: doubleLevelMatrix })
    }).authorized

    const [chosenUploadOption, setUploadOption] = useState<'MANY' | 'ONE' | null>(null)
    const uploadOption = chosenUploadOption ?? (canUploadMany ? 'MANY' : 'ONE')

    const canUpload = canUploadOne || canUploadMany
    const canOpenEditPopUp = canUpdateCollection || canDestroyCollection
    const canOpenVisibilityPopUp = canUpdateRegularVisibility || canUpdateAdminVisibility

    if (!canUpload && !canOpenEditPopUp && !canOpenVisibilityPopUp) return null

    return (
        <div className="flex flex-row items-center gap-2">
            {
                canUpload && (
                    <UploadHeaderItemPopUp popUpKey="UploadImages">
                        <div className="
                            flex flex-col gap-4 w-[min(50vw,560px)] max-w-full
                            max-mobile:w-full
                        ">
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
                                        className="self-start m-0!"
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
                                        color="base"
                                        label="Navn"
                                        name="collectionName"
                                    />
                                    <TextInput
                                        defaultValue={collection.description || ''}
                                        color="base"
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
                                    successCallback={() => router.push(appHref('/image-collections'))}
                                    action={configureAction(
                                        destroyDynamicImageCollectionAction,
                                        { params: { collectionId } }
                                    )}
                                    submitColor="red"
                                    confirmation={{
                                        confirm: true,
                                        text:
                                            'Er du sikker på at du vil slette samlingen? ' +
                                            'Dette sletter også alle bildene i samlingen.'
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
                        <div className="flex flex-col gap-4">
                            <imageCollectionVisibility.Forms
                                doubleLevelVisibility={doubleLevelVisibility}
                                visibilityIds={{
                                    regular: collection.visibilityRegularId,
                                    admin: collection.visibilityAdminId,
                                }}
                                params={{ collectionId }}
                            />
                        </div>
                    </VisibilityHeaderItemPopUp>
                )
            }
        </div>
    )
}
