import CompanyLoginForm from './CompanyLoginForm'
import { companyLoginCallbackUrl } from './companyLoginCallbackUrl'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

/** Where a company user signs in. It is served on the career site, as their session only exists there. */
const { page, generateMetadata } = serverPage({
    operation: ({ searchParams }: PageOperationArgs) => ({ callbackUrl: companyLoginCallbackUrl(searchParams) }),
    metadata: () => ({ title: 'Bedriftsinnlogging' }),
    render: ({ data }) => <CompanyLoginForm callbackUrl={data.callbackUrl} />,
})

export default page
export { generateMetadata }
