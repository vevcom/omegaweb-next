'use client'
import { revueAdminLinks } from '@/app/(revue)/revue/(static-theme)/admin/links'
import RevueMetaForms from '@/app/(revue)/_components/RevueMetaForms'
import type { ComponentProps } from 'react'

/** The revue's settings on its admin page, which follows the revue to its new year and leaves once it is gone. */
export default function RevueAdminMetaForms(props: Pick<ComponentProps<typeof RevueMetaForms>, 'revue' | 'capabilities'>) {
    return <RevueMetaForms {...props} hrefOfUpdated={revueAdminLinks.revue} hrefAfterDestroy={revueAdminLinks.revues()} />
}
