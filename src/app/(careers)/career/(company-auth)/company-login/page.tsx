import CompanyLoginForm from './CompanyLoginForm'
import { serverPage } from '@/app/ServerPage'

/** Where a company user signs in. It is served on the career site, as their session only exists there. */
const { page, generateMetadata } = serverPage({
    operation: () => ({}),
    metadata: () => ({ title: 'Bedriftsinnlogging' }),
    render: () => <CompanyLoginForm />,
})

export default page
export { generateMetadata }
