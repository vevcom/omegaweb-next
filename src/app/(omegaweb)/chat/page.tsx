import ChatAccountNotice from './ChatAccountNotice'
import ChatRoomList from './ChatRoomList'
import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import { chatSessionOperations } from '@/services/chat/session/operations'
import { chatUserOperations } from '@/services/chat/users/operations'
import { chatClientOrigin } from '@/services/chat/constants'
import SiteLink from '@/components/SiteLink/SiteLink'
import { serverPage, withFallback } from '@/app/ServerPage'
import { externalHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        const ofUser = { params: { userId: authorizeChatPage(session).id } }
        const chatSession = await withFallback(chatSessionOperations.read(ofUser), null, ['NOT FOUND'])
        if (!chatSession) {
            const chatUser = await withFallback(chatUserOperations.read(ofUser), null, ['NOT FOUND'])
            return { signsIn: false as const, hasChatAccount: chatUser !== null }
        }
        const spaces = await chatUserOperations.readSpaces(ofUser)
        return {
            signsIn: true as const,
            roomIdsOfSpaces: spaces
                .flatMap(space => [space.matrixRoomId, ...space.rooms.map(room => room.matrixRoomId)])
                .filter(roomId => roomId !== null),
        }
    },
    metadata: () => ({ title: 'Meldinger' }),
    render: ({ data }) => (
        <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
            <h2 className="m-0">Meldinger</h2>
            {data.signsIn ? <ChatRoomList roomIdsOfSpaces={data.roomIdsOfSpaces} /> : <>
                <p className="m-0">
                    Direktemeldinger og grupper ligger bare på chatten, så de vises ikke her ennå.
                    {chatClientOrigin && ' Du leser og skriver dem i Element.'}
                </p>
                <ChatAccountNotice hasChatAccount={data.hasChatAccount} />
                {chatClientOrigin && (
                    <SiteLink href={externalHref(chatClientOrigin)} target="_blank">Åpne chatten</SiteLink>
                )}
            </>}
        </div>
    ),
})

export default page
export { generateMetadata }
