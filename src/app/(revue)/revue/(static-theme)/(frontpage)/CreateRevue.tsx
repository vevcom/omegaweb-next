'use client'
import { revueLinks } from '@/app/(revue)/links'
import CreateRevueForm from '@/app/(revue)/_components/CreateRevueForm'
import PopUp from '@/components/PopUp/PopUp'
import useEditMode from '@/hooks/useEditMode'
import { revueAuth } from '@/services/revue/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import type { RevueGroupsForNewRevue } from '@/services/revue/groups/types'

const popUpKey = 'CreateRevue'

export default function CreateRevue({ groups }: { groups: RevueGroupsForNewRevue | null }) {
    const editable = useEditMode({ authorizer: revueAuth.create })

    if (!editable) return null
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                flex items-center justify-center gap-2 w-full p-4 border border-dashed border-base-300 bg-transparent
                text-base-content/80 cursor-pointer transition-colors
                hover:bg-base-300
            "
            showButtonContent={<>
                <FontAwesomeIcon icon={faPlus} />
                Legg til revy
            </>}
        >
            <CreateRevueForm closePopUpOnSuccess={popUpKey} hrefOfCreated={revueLinks.revue} groups={groups} />
        </PopUp>
    )
}
