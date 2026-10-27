import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import FileInput from '@/components/UI/FileInput'
import LicenseChooser from '@/components/LicenseChooser/LicenseChooser'
import type { UploadSpecialCollectionImageAction } from '@/services/images/subservice/types'
import type { PopUpKeyType } from '@/contexts/PopUp'

type PropTypes = {
    uploadImageAction: UploadSpecialCollectionImageAction,
    title?: string,
    className?: string,
    successCallback?: (data?: unknown) => void,
    refreshOnSuccess?: boolean,
    closePopUpOnSuccess?: PopUpKeyType,
}

/**
 * uplaod form for an image. Uses the provided uploader action, eiteher an upload action
 * to a special collection or a dynamic one.
 */
export default function ImageUploader({
    uploadImageAction,
    title,
    className,
    successCallback,
    refreshOnSuccess,
    closePopUpOnSuccess,
}: PropTypes) {
    return (
        <Form
            className={className}
            title={title}
            submitText="Last opp"
            action={uploadImageAction}
            successCallback={successCallback}
            refreshOnSuccess={refreshOnSuccess}
            closePopUpOnSuccess={closePopUpOnSuccess}
        >
            <TextInput color="black" label="Navn" name="imageName" />
            <TextInput color="black" label="Alternativ tekst" name="imageAlt" />
            <TextInput color="black" label="Kreditert" name="imageCredit" />
            <LicenseChooser name="imageLicenseId" />
            <FileInput label="Fil" name="imageFile" color="primary" />
        </Form>
    )
}
