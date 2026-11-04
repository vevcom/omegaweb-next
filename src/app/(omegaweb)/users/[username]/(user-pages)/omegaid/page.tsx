import OmegaId from '@/components/OmegaId/Identification/OmegaId'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        await getProfileForUserPage(params, 'omegaid', session)
    },
    metadata: () => ({ title: 'Omega-ID' }),
    render: () => (
        <div className="
            min-h-full flex justify-center items-center p-[1rem] bg-surface-base rounded-round
            [&>div]:w-full [&>div]:max-w-[20rem]
        ">
            <OmegaId />
        </div>
    ),
})

export default page
export { generateMetadata }
