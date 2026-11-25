import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import OpenChatRoom from '@/components/Chat/Room/OpenChatRoom'
import SiteLink from '@/components/SiteLink/SiteLink'
import { chatSessionOperations } from '@/services/chat/session/operations'
import { chatUserOperations } from '@/services/chat/users/operations'
import { siteRedirect } from '@/app/domainContextOfRequest'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ roomId: string }>) => {
        const ofUser = { params: { userId: authorizeChatPage(session).id } }
        await chatSessionOperations.read(ofUser)
        const roomId = decodeURIComponent(params.roomId)
        // A room of a space has a page of its own, which knows what the homeserver refuses in it.
        const spaces = await chatUserOperations.readSpaces(ofUser)
        const ofSpace = spaces.flatMap(space => space.rooms).find(room => room.matrixRoomId === roomId)
        if (ofSpace) await siteRedirect(chatLinks.spaceRoom(ofSpace))
        return { roomId }
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
