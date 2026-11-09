import { revueAdminNavDef } from '@/app/(revue)/revue/admin/revueAdminNavDef'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ session }: PageOperationArgs) => revueAdminNavDef.authorizeAny(session),
    metadata: () => ({ title: 'Administrasjon' }),
    render: () => <p className="text-base-content/80">Velg hva du vil administrere i menyen</p>,
})

export default page
export { generateMetadata }
