'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import useEditMode from '@/hooks/useEditMode'
import { createCareersTeamDepartmentAction } from '@/services/careers/team/actions'
import { careersTeamAuth } from '@/services/careers/team/auth'

export default function AddTeamDepartment() {
    const editable = useEditMode({ authorizer: careersTeamAuth.createDepartment })

    if (!editable) return null
    return (
        <div className="max-w-md p-6 border border-dashed border-surface-subtle">
            <Form
                title="Ny avdeling"
                action={createCareersTeamDepartmentAction}
                submitText="Legg til avdeling"
                refreshOnSuccess
            >
                <TextInput name="name" label="Navn" />
            </Form>
        </div>
    )
}
