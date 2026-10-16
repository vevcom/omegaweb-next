import styles from './page.module.scss'
import { committeeParticipationOperations } from '@/services/applications/committeeParticipation/operations'
import { serverPage } from '@/app/serverPage'
import ProfilePicture from '@/components/User/ProfilePicture'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ shortName: string, participationId: string }>) => {
        const participationId = parseInt(params.participationId, 10)
        return committeeParticipationOperations.read({ params: { participationId } })
    },
    render: ({ data: applications }) => {
        if (applications.length === 0) { return 'ingen søknader funnet' }
        const sortedApplications = [...applications].sort(
            (applicationOne, applicationTwo) => applicationOne.priority - applicationTwo.priority
        )

        return (
            <div className={styles.applicationsContainer}>
                {sortedApplications.map((application, index) => (
                    <div className={styles.applicationContainer} key={index}>
                        <div className={styles.headingContainer}>
                            <h3>{application.priority}.</h3>
                            <ProfilePicture
                                width={50}
                                profileImage={application.user.image}
                                className={styles.profilePicture}
                            />
                            <Link className={styles.applicantName} href={`/users/${application.user.username}`}>
                                <h3>{application.user.firstname} {application.user.lastname}</h3>
                            </Link>
                        </div>
                        <div className={styles.applicationTextContainer}>
                            <p className={styles.applicationText}>{application.text}</p>
                        </div>
                    </div >
                ))
                }
            </div >
        )
    },
})

export default page
export { generateMetadata }
