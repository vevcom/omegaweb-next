import { careerAdminNavDef } from '@/app/(careers)/career/admin/careerAdminNavDef'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ session }: PageOperationArgs) => careerAdminNavDef.authorizeAny(session),
    metadata: () => ({ title: 'Administrasjon' }),
    render: () => <p className="text-text-muted">Velg hva du vil administrere i menyen</p>,
})

export default page
export { generateMetadata }
