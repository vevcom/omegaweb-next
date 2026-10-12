import type { Permission } from '@/prisma-generated-pn-types'

export function checkForPermissionDuplicates(arr: Permission[], failMessage: string) {
    const permissionSet = new Set(arr)
    if (permissionSet.size !== arr.length) {
        const duplicates = arr.filter((perm, index) => arr.indexOf(perm) !== index)
        throw new Error(
            `A duplicate permission is trying to be added to ${failMessage}, duplicates: ${duplicates.join(', ')}`
        )
    }
}

// EVENT_ADMIN and NOTIFICATION_ADMIN are deliberately absent. Granting either to every committee
// would bypass event visibility and registration-owner checks, or let committee members manage
// other users' notification subscriptions. Committees that administer events or notifications get
// those permissions directly. EVENT_CREATE, IMAGE_CREATE and NEWS_CREATE only let a committee
// create its own content, so they are safe to grant here.
export const COMMITTEE_PERMISSIONS: Permission[] = [
    'IMAGE_CREATE',
    'EVENT_CREATE',
    'NEWS_CREATE',
    'MAILSERVER_USE',
]
