import { chatLinks } from '@/app/(omegaweb)/chat/links'
import { chatUserAuth } from '@/services/chat/users/auth'
import { chatAuth, chatClientOrigin } from '@/services/chat/constants'
import { defineNavDef } from '@/lib/navDef/navDef'
import { externalHref } from '@/lib/sites/href'
import { faArrowUpRightFromSquare, faComments, faLayerGroup, faSliders } from '@fortawesome/free-solid-svg-icons'

const authorizers = () => [chatUserAuth.openPages]

/**
 * The chat pages, in the order they are shown. They are the signed-in user's own, so every item
 * has the one rule. Without a chat there are none.
 */
export const chatNavDef = defineNavDef(chatAuth ? [
    {
        key: 'messages',
        name: 'Meldinger',
        href: chatLinks.messages(),
        icon: faComments,
        authorizers,
    },
    {
        key: 'spaces',
        name: 'Chatområder',
        href: chatLinks.spaces(),
        icon: faLayerGroup,
        authorizers,
    },
    {
        key: 'settings',
        name: 'Innstillinger',
        href: chatLinks.settings(),
        icon: faSliders,
        authorizers,
    },
    ...(chatClientOrigin ? [{
        key: 'element',
        name: 'Åpne i Element',
        href: externalHref(chatClientOrigin),
        icon: faArrowUpRightFromSquare,
        authorizers,
    }] : []),
] : [])
