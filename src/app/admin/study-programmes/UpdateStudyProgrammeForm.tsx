'use client'

import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import TextInput from '@/components/UI/TextInput'
import { updateStudyProgrammeAction, createStudyProgrammeAction } from '@/services/groups/studyProgrammes/actions'
import { configureAction } from '@/services/configureAction'
import { CLASS_LEVEL_ORDERING, ClassLevelConfig } from '@/services/groups/constants'
import { useRouter } from 'next/navigation'
import type { StudyProgramme } from '@/prisma-generated-pn-types'


export default function UpdateStudyProgrammeForm({
    studyProgramme,
}: {
    studyProgramme?: StudyProgramme
}) {
    const { refresh } = useRouter()

    const create = studyProgramme === undefined

    return <Form
        title={`${create ? 'Legg til' : 'Oppdater'} studieprogram`}
        submitText={create ? 'Legg til' : 'Oppdater'}
        action={create
            ? createStudyProgrammeAction
            : configureAction(updateStudyProgrammeAction, { params: { id: studyProgramme.id } })
        }
        successCallback={true ? () => {} : refresh}
    >
        <TextInput name="name" label="Navn" defaultValue={studyProgramme?.name ?? ''}/>
        <TextInput name="code" label="Kode" defaultValue={studyProgramme?.code ?? ''} />
        <TextInput name="insititueCode" label="Institutt kode" defaultValue={studyProgramme?.insititueCode ?? ''} />
        <SelectString label="Startklasse" name="classLevel" options={[
            { value: '', label: 'Ikke satt' },
            ...CLASS_LEVEL_ORDERING.map(level => ({ value: level, label: ClassLevelConfig[level].name })),
        ]} defaultValue={studyProgramme?.classLevel ?? ''} />
        <TextInput name="yearsLength" label="Studiets lengde" defaultValue={studyProgramme?.yearsLength ?? ''} />
        <SelectString label="Del av Omega" name="partOfOmega" options={[
            { value: 'false', label: 'Nei' },
            { value: 'true', label: 'Ja' },
        ]} defaultValue={studyProgramme?.partOfOmega ? 'true' : 'false'} />

    </Form>
}
