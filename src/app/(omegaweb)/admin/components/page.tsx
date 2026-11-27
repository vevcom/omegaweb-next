import Components from './Components'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ session }: PageOperationArgs) => authorizeAdminPage('components', session),
    render: () => <Components />,
})

export default page
export { generateMetadata }
