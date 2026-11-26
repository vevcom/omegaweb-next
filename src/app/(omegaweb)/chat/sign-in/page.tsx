import ChatSignInCallback from './ChatSignInCallback'
import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import { chatSessionOperations } from '@/services/chat/session/operations'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        await chatSessionOperations.read({ params: { userId: authorizeChatPage(session).id } })
    },
    metadata: () => ({ title: 'Logger inn på chatten' }),
    render: () => (
        <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
            <h2 className="m-0">Chatten</h2>
            <ChatSignInCallback />
        </div>
    ),
})

export default page
export { generateMetadata }
