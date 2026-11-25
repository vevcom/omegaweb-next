import { revueLinks } from '@/app/(revue)/links'
import { revueAdminLinks } from '@/app/(revue)/revue/(static-theme)/admin/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import { revueThemeOf } from '@/app/(revue)/_lib/revueTheme'
import { scopedThemeProps } from '@/lib/theme'
import type { RevuePalette } from '@/app/(revue)/_lib/revueTheme'

type PropTypes = {
    revue: { year: number, name: string } & RevuePalette,
}

export default function RevueRow({ revue }: PropTypes) {
    return <li {...scopedThemeProps(revueThemeOf(revue))} className="
        flex items-center justify-between gap-4 px-4 py-3 border-t border-base-300 bg-base-100 text-base-content
    ">
        <SiteLink href={revueLinks.revue(revue)} className="min-w-0 text-inherit">
            <span className="font-semibold">{revue.name}</span>
            <span className="text-base-content/80"> ({revue.year})</span>
        </SiteLink>
        <SiteLink href={revueAdminLinks.revue(revue)} className="btn-neutral m-0">Administrer</SiteLink>
    </li>
}
