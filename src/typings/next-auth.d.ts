import 'next-auth'
import 'next-auth/adapters'

import type { MembershipFiltered } from '@/services/groups/types'
import type { Permission } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'

/** How a session was started. A login carried over from another domain keeps the one it began with. */
type SessionProvider = 'credentials' | 'feide'

declare module 'next-auth' {
    // The User object is defined in next-auth, and is extended with the properties from UserFiltered.
    interface User extends Partial<UserFiltered> {
        /** For a login carried over from another domain: how the session there was started. */
        sessionProvider?: SessionProvider,
    }

    interface Session {
        user: UserFiltered,
        permissions: Permission[],
        memberships: MembershipFiltered[],
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        provider: SessionProvider,
        user: UserFiltered,
        permissions: Permission[],
        memberships: MembershipFiltered[],
        // The user's session epoch when the session started. See `User.sessionEpoch`.
        sessionEpoch: number,
        // When the permissions and memberships above were read, in milliseconds since epoch.
        permissionsReadAt: number,

        // The standard JWT payload is hidden by next auth. To get correct
        // type hinting we need to declare the properties we wish to
        // access. Currently we only need to use iat (issued at).
        //
        // See https://www.rfc-editor.org/rfc/rfc7519#section-4.1 for the
        // JWT payload specification.
        iat?: number,
    }
}
