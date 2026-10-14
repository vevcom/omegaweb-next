'use client'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import NumberInput from '@/components/UI/NumberInput'
import { SelectNumber } from '@/components/UI/Select'
import { createCourseAction } from '@/education/courses/actions'
import type { SchoolFiltered } from '@/services/education/schools/types'

export default function CreateCourseForm({ schools }: { schools: SchoolFiltered[] }) {
    return (
        <Form action={createCourseAction} submitText="Lag emne" refreshOnSuccess closePopUpOnSuccess="createCourse">
            <SelectNumber
                name="schoolId"
                label="Skole"
                options={schools.map(school => ({ value: school.id, label: school.name }))}
            />
            <TextInput label="Emnekode" name="code" />
            <TextInput label="Navn" name="name" />
            <NumberInput label="Studiepoeng" name="ectsPoints" />
        </Form>
    )
}
