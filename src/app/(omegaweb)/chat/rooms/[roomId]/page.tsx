import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import OpenChatRoom from '@/components/Chat/Room/OpenChatRoom'
import SiteLink from '@/components/SiteLink/SiteLink'
import { chatSessionOperations } from '@/services/chat/session/operations'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ roomId: string }>) => {
        await chatSessionOperations.read({ params: { userId: authorizeChatPage(session).id } })
        return { roomId: decodeURIComponent(params.roomId) }
    },
    metadata: () => ({ title: 'Samtale' }),
    render: ({ data: { roomId } }) => (
        <OpenChatRoom room={{ id: roomId }}>
            <p className="m-0">Du er ikke med i noen samtale med denne adressen.</p>
            <SiteLink href={chatLinks.messages()}>Alle meldinger</SiteLink>
        </OpenChatRoom>
    ),
})

export default page
export { generateMetadata }
