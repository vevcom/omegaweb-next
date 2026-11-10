import TermsArticle from '@/components/Terms/TermsArticle'
import { serverPage } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    // The terms are read before they are accepted.
    allowUnregistered: true,
    operation: () => ({}),
    metadata: () => ({
        title: 'Vilkår og personvern',
        description: 'Vilkår for bruk av Veven og personvernerklæring for Sanctus Omega Broderskab.',
    }),
    render: () => <TermsArticle />,
})

export default page
export { generateMetadata }
