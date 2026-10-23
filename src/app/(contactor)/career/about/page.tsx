import { serverPage } from '@/app/ServerPage'

/** Contactor's "about us" page. Empty for now: the frontpage links here from its "om oss" section. */
const { page, generateMetadata } = serverPage({
    operation: () => ({}),
    metadata: () => ({ title: 'Om oss' }),
    render: () => (
        <div className="py-20">
            <h1 className="mb-4 text-xxl text-contactor-navy">Om Contactor</h1>
            <p className="text-l text-text-muted">Her kommer det mer om oss.</p>
        </div>
    ),
})

export default page
export { generateMetadata }
