import ComponentTest from './ComponentTest'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => authorizeAdminPage('component-test', session),
    render: () => <ComponentTest />,
})

export default page
export { generateMetadata }
