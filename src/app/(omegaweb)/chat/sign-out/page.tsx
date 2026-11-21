import ChatSignOut from './ChatSignOut'
import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import { chatSessionOperations } from '@/services/chat/session/operations'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

/**
 * A step of logging out, see LogOut: it is a chat page, so its content security policy lets it
 * reach the chat to end the browser's session there, which the logout page's does not. Nothing is
 * ended unless the logout page sent the browser here.
 */
const { page, generateMetadata } = serverPage({
    operation: async ({ session, searchParams }: PageOperationArgs) => {
        await chatSessionOperations.read({ params: { userId: authorizeChatPage(session).id } })
        return { callbackUrl: QueryParams.callbackUrl.decode(searchParams) ?? notFound() }
    },
    metadata: () => ({ title: 'Logger ut av chatten' }),
    render: ({ data: { callbackUrl } }) => (
        <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
            <h2 className="m-0">Chatten</h2>
            <ChatSignOut callbackUrl={callbackUrl} />
        </div>
    ),
})

export default page
export { generateMetadata }
