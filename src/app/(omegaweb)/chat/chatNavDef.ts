import { chatLinks } from '@/app/(omegaweb)/chat/links'
import { chatUserAuth } from '@/services/chat/users/auth'
import { chatAuth, chatClientOrigin } from '@/services/chat/constants'
import { defineNavDef } from '@/lib/navDef/navDef'
import { externalHref } from '@/lib/sites/href'
import { faArrowUpRightFromSquare, faComments, faLayerGroup, faSliders } from '@fortawesome/free-solid-svg-icons'

/**
 * The chat pages of a user, in the order they are shown. An item has the rules of what its page
 * reads, with the user's id, so the pages are the user's own. Without a chat there are none.
 */
export function chatNavDef({ userId }: { userId: number }) {
    const ofUser = { userId }
    return defineNavDef(chatAuth ? [
        {
            key: 'messages',
            name: 'Meldinger',
            href: chatLinks.messages(),
            icon: faComments,
            authorizers: () => [chatUserAuth.read.data(ofUser)],
        },
        {
            key: 'spaces',
            name: 'Chatområder',
            href: chatLinks.spaces(),
            icon: faLayerGroup,
            authorizers: () => [chatUserAuth.readSpaces.data(ofUser)],
        },
        {
            key: 'settings',
            name: 'Innstillinger',
            href: chatLinks.settings(),
            icon: faSliders,
            authorizers: () => [chatUserAuth.readSpaces.data(ofUser)],
        },
        ...(chatClientOrigin ? [{
            key: 'element',
            // The chat client is no page of the app, and is for whoever has the messages.
            name: 'Åpne i Element',
            href: externalHref(chatClientOrigin),
            icon: faArrowUpRightFromSquare,
            authorizers: () => [chatUserAuth.read.data(ofUser)],
        }] : []),
    ] : [])
}
