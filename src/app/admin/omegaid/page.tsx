import OmegaIdContainer from './container'
import { omegaIdOperations } from '@/services/omegaid/operations'
import { serverPage } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async () => omegaIdOperations.readPublicKey({}),
    render: ({ data: publicKey }) => <OmegaIdContainer publicKey={publicKey} />,
})

export default page
export { generateMetadata }
