'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import { careersTeamCapabilities } from '@/capabilities/careers/team/capabilities'

export default function AddTeamDepartment() {
    const editable = useEditMode({ authorizer: careersTeamCapabilities.createDepartment.authorizer })

    if (!editable) return null
    return (
        <div className="max-w-md p-6 border border-dashed border-base-300">
            <Form
                title="Ny avdeling"
                action={careersTeamCapabilities.createDepartment.action}
                submitText="Legg til avdeling"
                refreshOnSuccess
            >
                <TextInput name="name" label="Navn" />
            </Form>
        </div>
    )
}
