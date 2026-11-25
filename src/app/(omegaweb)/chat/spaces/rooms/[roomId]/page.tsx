import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import JoinSpaceRoom from '@/components/Chat/Membership/JoinSpaceRoom'
import OpenChatRoom from '@/components/Chat/Room/OpenChatRoom'
import { chatSessionOperations } from '@/services/chat/session/operations'
import { chatUserOperations } from '@/services/chat/users/operations'
import { ServiceError } from '@/services/error'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ roomId: string }>) => {
        const ofUser = { params: { userId: authorizeChatPage(session).id } }
        await chatSessionOperations.read(ofUser)
        const spaces = await chatUserOperations.readSpaces(ofUser)
        const room = spaces.flatMap(space => space.rooms).find(roomOfSpace => roomOfSpace.id === Number(params.roomId))
        if (!room) throw new ServiceError('NOT FOUND', 'Du er ikke med i noe chatområde med dette rommet')
        return room
    },
    metadata: room => ({ title: room.name }),
    render: ({ data: room }) => (room.matrixRoomId ? (
        <OpenChatRoom room={{ id: room.matrixRoomId }} ofSpace={{ name: room.name, isPrivate: room.isPrivate }}>
            <JoinSpaceRoom roomId={room.matrixRoomId} isPrivate={room.isPrivate} />
        </OpenChatRoom>
    ) : (
        <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
            <h2 className="m-0">{room.name}</h2>
            <p className="m-0">Rommet er ikke opprettet på chatten ennå. Prøv igjen om litt.</p>
        </div>
    )),
})

export default page
export { generateMetadata }
