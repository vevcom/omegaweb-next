import { careerAdminNavDef } from '@/app/(careers)/career/admin/careerAdminNavDef'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ session }: PageOperationArgs) => careerAdminNavDef.authorize('companies', session),
    metadata: () => ({ title: 'Bedrifter' }),
    render: () => <h1 className="text-xl text-careers-navy">Bedrifter</h1>,
})

export default page
export { generateMetadata }
