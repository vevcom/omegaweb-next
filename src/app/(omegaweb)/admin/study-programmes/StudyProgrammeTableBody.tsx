'use client'

import UpdateStudyProgrammeForm from './UpdateStudyProgrammeForm'
import PopUp from '@/components/PopUp/PopUp'
import { ClassLevelConfig } from '@/services/groups/constants'
import { studyProgrammeAuth } from '@/services/groups/studyProgrammes/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import Link from 'next/link'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { StudyProgramme } from '@/prisma-generated-pn-types'


export default function StudyProgrammeTableBody({ studyprogrammes }: { studyprogrammes: StudyProgramme[] }) {
    const canEdit = useAuthorizer({ authorizer: studyProgrammeAuth.update }).authorized
    return <tbody>
        {studyprogrammes.map(studyProgramme =>
            <tr key={studyProgramme.id}>
                {canEdit && <td className="text-center"><PopUp title={`Oppdater ${studyProgramme.name}`}
                    showButtonContent={<FontAwesomeIcon icon={faPencil} />}
                    showButtonClass="w-[30px] h-[30px] border-none bg-transparent"
                    popUpKey={`UpdateStudyProgramme${studyProgramme.id}`}
                >
                    <UpdateStudyProgrammeForm studyProgramme={studyProgramme} />
                </PopUp></td>}
                <th>
                    <Link href={`/admin/study-programmes/${studyProgramme.id}`}>
                        {studyProgramme.name}
                    </Link>
                </th>
                <td>{studyProgramme.code}</td>
                <td>{studyProgramme.instituteCode ?? ''}</td>
                <td>{studyProgramme.classLevel ? ClassLevelConfig[studyProgramme.classLevel].name : ''}</td>
                <td>{studyProgramme.yearsLength ?? ''}</td>
                <td>{studyProgramme.partOfOmega ? 'Ja' : 'Nei'}</td>
            </tr>
        )}
    </tbody>
}
