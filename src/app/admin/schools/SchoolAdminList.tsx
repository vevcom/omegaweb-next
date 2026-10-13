import styles from './SchoolAdminList.module.scss'
import Link from 'next/link'
import type { SchoolFiltered } from '@/services/education/schools/types'

type PropTypes = {
    schools: SchoolFiltered[]
}

export async function SchoolAdminList({ schools }: PropTypes) {
    return (
        <table className={styles.SchoolAdminList}>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Navn</th>
                    <th>Kortnavn</th>
                </tr>
            </thead>
            <tbody>
                {schools.map(school => (
                    <Link key={school.shortName}
                        aria-label={`Gå til skolesiden for ${school.name}`}
                        href={`/admin/schools/${encodeURIComponent(school.shortName)}`}>
                        <tr key={school.id}>
                            <td>{school.id}</td>
                            <td>{school.name}</td>
                            <td>{school.shortName}</td>
                        </tr>
                    </Link>
                ))}
            </tbody>
        </table>
    )
}
