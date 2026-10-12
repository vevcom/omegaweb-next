import ThemeForm from '@/app/users/[username]/(user-pages)/theme/ThemeForm'
import { getProfileForUserPage } from '@/app/users/[username]/(user-pages)/getProfileForUserPage'
import { serverPage } from '@/app/serverPage'
import { Theme } from '@/lib/theme'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        await getProfileForUserPage(params, 'theme', session)
        return { theme: session.user?.theme ?? Theme.STANDARD }
    },
    render: ({ data }) => (
        <ThemeForm activeTheme={data.theme}></ThemeForm>
    ),
})

export default page
export { generateMetadata }
