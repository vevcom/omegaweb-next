import { careerAdminNavDef } from '@/app/(careers)/career/admin/careerAdminNavDef'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ session }: PageOperationArgs) => careerAdminNavDef.authorize('mail', session),
    metadata: () => ({ title: 'E-posttjener' }),
    render: () => <h1 className="text-xl text-careers-navy">E-posttjener</h1>,
})

export default page
export { generateMetadata }
