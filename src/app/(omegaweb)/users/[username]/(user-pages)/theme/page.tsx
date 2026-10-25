import ThemeForm from '@/app/(omegaweb)/users/[username]/(user-pages)/theme/ThemeForm'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { serverPage } from '@/app/ServerPage'
import { userOperations } from '@/services/users/operations'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'theme', session)
        const privateUser = await userOperations.read({ params: { username: profile.user.username } })
        return { username: profile.user.username, theme: privateUser.theme }
    },
    render: ({ data }) => (
        <ThemeForm username={data.username} activeTheme={data.theme}></ThemeForm>
    ),
})

export default page
export { generateMetadata }
