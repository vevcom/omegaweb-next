import { committeeParticipationOperations } from '@/services/applications/committeeParticipation/operations'
import { serverPage } from '@/app/ServerPage'
import ProfilePicture from '@/components/User/ProfilePicture'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/ServerPage'

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
            <div>
                {sortedApplications.map((application, index) => (
                    <div className="mt-[1em] flex flex-col border-2 border-[hsla(0,0%,70%,0.507)] round" key={index}>
                        <div className="
                            flex items-center
                            [&_*]:inline-block [&_*]:mx-[0.1em]
                        ">
                            <h3>{application.priority}.</h3>
                            <ProfilePicture
                                width={50}
                                profileImage={application.user.image}
                            />
                            <Link className="text-black" href={`/users/${application.user.username}`}>
                                <h3>{application.user.firstname} {application.user.lastname}</h3>
                            </Link>
                        </div>
                        <div>
                            <p>{application.text}</p>
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
