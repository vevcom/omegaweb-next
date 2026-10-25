import OmegaIdContainer from './OmegaIdContainer'
import { omegaIdOperations } from '@/services/omegaid/operations'
import { serverPage } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async () => omegaIdOperations.readPublicKey({}),
    render: ({ data: publicKey }) => <OmegaIdContainer publicKey={publicKey} />,
})

export default page
export { generateMetadata }
