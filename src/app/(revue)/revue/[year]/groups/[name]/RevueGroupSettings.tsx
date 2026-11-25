'use client'
import { revueLinks } from '@/app/(revue)/links'
import RevueGroupMetaForms from '@/app/(revue)/_components/RevueGroupMetaForms'
import PopUp from '@/components/PopUp/PopUp'
import useEditMode from '@/hooks/useEditMode'
import { revueGroupAuth } from '@/services/revue/groups/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'
import type { RevueGroupType } from '@/prisma-generated-pn-types'

type PropTypes = {
    group: { id: number, name: string, type: RevueGroupType },
    revue: { year: number },
}

export default function RevueGroupSettings({ group, revue }: PropTypes) {
    const editable = useEditMode({ authorizer: revueGroupAuth.update })
    const popUpKey = `RevueGroupSettings${group.id}`

    if (!editable) return null
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                p-2 text-base-content/80 bg-transparent border-none cursor-pointer
                hover:text-base-content
            "
            showButtonContent={<FontAwesomeIcon icon={faGear} />}
            ariaLabel={`Innstillinger for ${group.name}`}
        >
            <RevueGroupMetaForms
                group={group}
                closePopUpOnSuccess={popUpKey}
                hrefOfUpdated={updated => revueLinks.revueGroup(revue, updated)}
                hrefAfterDestroy={revueLinks.revue(revue)}
            />
        </PopUp>
    )
}
