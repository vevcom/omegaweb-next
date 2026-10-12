import ThemeForm from '@/app/users/[username]/(user-pages)/theme/ThemeForm'
import { getProfileForUserPage } from '@/app/users/[username]/(user-pages)/getProfileForUserPage'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    // The theme is the viewer's own and lives in their browser, so the page is only for the user
    // themselves - which is what its nav item says, and what this holds the page to.
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        await getProfileForUserPage(params, 'theme', session)
        return null
    },
    render: () => (
        <ThemeForm></ThemeForm>
    ),
})

export default page
export { generateMetadata }
