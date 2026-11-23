import SiteLink from '@/components/SiteLink/SiteLink'
import type { ReactNode } from 'react'
import type { AppHref } from '@/lib/sites/href'

/**
 * A link in one cell of a table row that stretches over the whole row, so the row is clickable
 * while the table stays valid HTML. The row must be `relative`.
 */
export default function RowLink({ href, children }: { href: AppHref, children: ReactNode }) {
    return <SiteLink href={href} className="
        no-underline text-inherit
        after:absolute after:inset-0
    ">
        {children}
    </SiteLink>
}
