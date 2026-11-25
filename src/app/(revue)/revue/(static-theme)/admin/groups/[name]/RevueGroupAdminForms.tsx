'use client'
import { revueAdminLinks } from '@/app/(revue)/revue/(static-theme)/admin/links'
import RevueGroupMetaForms from '@/app/(revue)/_components/RevueGroupMetaForms'
import type { RevueGroupType } from '@/prisma-generated-pn-types'

/** The rename and delete of a group on its admin page, which follow the group to its new address or to the list. */
export default function RevueGroupAdminForms({ group }: { group: { id: number, name: string, type: RevueGroupType } }) {
    return (
        <RevueGroupMetaForms
            group={group}
            hrefOfUpdated={revueAdminLinks.group}
            hrefAfterDestroy={revueAdminLinks.groups()}
        />
    )
}
