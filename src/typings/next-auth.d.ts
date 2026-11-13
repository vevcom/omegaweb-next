import 'next-auth'
import 'next-auth/adapters'

import type { MembershipFiltered } from '@/services/groups/types'
import type { Permission } from '@/prisma-generated-pn-types'
import type { UserFiltered } from '@/services/users/types'
import type { CompanyUserOfSession } from '@/services/careers/companies/users/types'

declare module 'next-auth' {
    // Normally we dissallow typing with empty objects, but in this case we
    // need to extend the User object with additional properties. The User
    // object is defined in next-auth, and we need to extend it with the
    // properties from UserFiltered. So for this case we allow it.
    //
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends Partial<UserFiltered> {}

    // A session belongs to a user or to a company user, never to both. See `Session.fromToken`.
    interface Session {
        user: UserFiltered | null,
        companyUser: CompanyUserOfSession | null,
        permissions: Permission[],
        memberships: MembershipFiltered[],
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        // 'company-credentials' is the login of a company user, and the only one that gives a
        // token with a company user and no user.
        provider: 'credentials' | 'feide' | 'company-credentials',
        user: UserFiltered | null,
        companyUser: CompanyUserOfSession | null,
        permissions: Permission[],
        memberships: MembershipFiltered[],
        // The session epoch of the user or company user when the session started. See `User.sessionEpoch`.
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
