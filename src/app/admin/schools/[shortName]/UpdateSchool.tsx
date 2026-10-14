'use client'
import Form from '@/components/Form/Form'
import { updateSchoolAction } from '@/education/schools/actions'
import TextInput from '@/components/UI/TextInput'
import { configureAction } from '@/services/configureAction'
import type { SchoolFiltered } from '@/services/education/schools/types'

type PropTypes = {
    school: SchoolFiltered
}

export default function UpdateSchool({ school }: PropTypes) {
    const updateAction = configureAction(
        updateSchoolAction,
        { params: { id: school.id } }
    )

    return (
        <Form
            submitText="Oppdater"
            action={updateAction}
            navigateOnSuccess={data => (data ? `/admin/schools/${data.shortName}` : '/admin/schools')}
        >
            <TextInput name="name" label="Navn" defaultValue={school.name} />
            <TextInput name="shortName" label="Kortnavn" defaultValue={school.shortName} />
        </Form>
    )
}
