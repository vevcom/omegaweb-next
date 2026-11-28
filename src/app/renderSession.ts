import '@ow-server-only'
import { authOptions } from '@/auth/nextAuth/authOptions'
import { ServerSession } from '@/auth/session/ServerSession'
import { getServerSession } from 'next-auth'
import { cache } from 'react'

/**
 * `ServerSession` for a render: the same session, kept in React's `cache`, so the layouts, the page,
 * its sections and its server components read it once between them. Every render on the server
 * reads it again. Outside a render, as in a route handler, nothing is kept. It lives here and not in
 * `ServerSession`, since `src/auth` imports no React.
 */
export class RenderSession {
    /** The NextAuth session of the render, which the root layout hands to the browser. */
    public static readonly nextAuthSession = cache(() => getServerSession(authOptions))

    /** `ServerSession.fromNextAuth()` of the render, built from the same NextAuth read. */
    public static readonly fromNextAuth = cache(() => ServerSession.fromNextAuth(RenderSession.nextAuthSession))
}
