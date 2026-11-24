'use client'
import RevueGroupsInRevueForms from './RevueGroupsInRevueForms'
import { revueLinks } from '@/app/(revue)/links'
import RevueMetaForms from '@/app/(revue)/_components/RevueMetaForms'
import PopUp from '@/components/PopUp/PopUp'
import useAuthorizer from '@/hooks/useAuthorizer'
import useEditMode from '@/hooks/useEditMode'
import { revueAuth } from '@/services/revue/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear } from '@fortawesome/free-solid-svg-icons'
import type { RevuePalette } from '@/app/(revue)/_lib/revueTheme'
import type { ComponentProps } from 'react'

type PropTypes = {
    revue: { id: number, year: number, name: string } & RevuePalette,
    /** Given to those who may read every revue group, to put them in the revue and take them out. */
    groups: Omit<ComponentProps<typeof RevueGroupsInRevueForms>, 'revueId'> | null,
}

export default function RevueSettings({ revue, groups }: PropTypes) {
    const canUpdate = useAuthorizer({ authorizer: revueAuth.update })
    const canDestroy = useAuthorizer({ authorizer: revueAuth.destroy })
    const editable = useEditMode({ authorizer: revueAuth.update.or().allOf(revueAuth.destroy) })
    const popUpKey = `RevueSettings${revue.id}`

    if (!editable) return null
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                p-2 text-base-content/80 bg-transparent border-none cursor-pointer
                hover:text-base-content
            "
            showButtonContent={<FontAwesomeIcon icon={faGear} />}
            ariaLabel={`Innstillinger for ${revue.name}`}
        >
            <div className="flex flex-col gap-8">
                <RevueMetaForms
                    revue={revue}
                    capabilities={{ canUpdate: canUpdate.toJsObject(), canDestroy: canDestroy.toJsObject() }}
                    closePopUpOnSuccess={popUpKey}
                    hrefOfUpdated={revueLinks.revue}
                    hrefAfterDestroy={revueLinks.frontpage()}
                />
                {groups && <RevueGroupsInRevueForms revueId={revue.id} {...groups} />}
            </div>
        </PopUp>
    )
}
