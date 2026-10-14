import styles from './CreateCommitteeForm.module.scss'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import FileInput from '@/components/UI/FileInput'
import LicenseChooser from '@/components/LicenseChooser/LicenseChooser'
import { createCommitteeAction } from '@/services/groups/committees/actions'

/**
 * A form to create a committee. The logo fields are optional - if left empty the committee falls
 * back to the shared default committee logo, which can be replaced later from the committee's own
 * admin page.
 */
export default function CreateCommitteeForm() {
    return (
        <div className={styles.CreateCommitteeForm}>
            <Form action={createCommitteeAction}>
                <TextInput name="name" label="Navn" />
                <TextInput name="shortName" label="Kortnavn" />
                <FileInput label="Logo" name="imageFile" color="primary" />
                <TextInput label="Alternativ tekst for logo" name="imageAlt" />
                <TextInput label="Kreditert" name="imageCredit" />
                <LicenseChooser name="imageLicenseId" />
            </Form>
        </div>
    )
}
