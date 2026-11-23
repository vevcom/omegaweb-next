'use client'
import { revueLinks } from '@/app/(revue)/links'
import RevueMetaForms from '@/app/(revue)/_components/RevueMetaForms'
import PopUp from '@/components/PopUp/PopUp'
import SiteLink from '@/components/SiteLink/SiteLink'
import { revueThemeOf } from '@/app/(revue)/_lib/revueTheme'
import { scopedThemeProps } from '@/lib/theme'
import type { RevuePalette } from '@/app/(revue)/_lib/revueTheme'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    revue: { id: number, year: number, name: string } & RevuePalette,
    capabilities: CapabilitiesJsObject<'canUpdate' | 'canDestroy'>,
}

export default function RevueRow({ revue, capabilities }: PropTypes) {
    const popUpKey = `RevueAdmin${revue.id}`
    const canChange = capabilities.canUpdate.authorized || capabilities.canDestroy.authorized

    return <li {...scopedThemeProps(revueThemeOf(revue))} className="
        flex items-center justify-between gap-4 px-4 py-3 border-t border-base-300 bg-base-100 text-base-content
    ">
        <SiteLink href={revueLinks.revue(revue)} className="min-w-0 text-inherit">
            <span className="font-semibold">{revue.name}</span>
            <span className="text-base-content/80"> ({revue.year})</span>
        </SiteLink>
        {canChange && <PopUp
            popUpKey={popUpKey}
            showButtonClass="btn-neutral m-0"
            showButtonContent="Endre"
            ariaLabel={`Endre ${revue.name}`}
        >
            <RevueMetaForms revue={revue} capabilities={capabilities} closePopUpOnSuccess={popUpKey} />
        </PopUp>}
    </li>
}
