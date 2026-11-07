'use client'
import RevueGroupMemberForm from './RevueGroupMemberForm'
import PopUp from '@/components/PopUp/PopUp'
import useEditMode from '@/hooks/useEditMode'
import { configureAction } from '@/services/configureAction'
import { createRevueGroupMemberAction } from '@/services/revue/groups/members/actions'
import { revueGroupMemberAuth } from '@/services/revue/groups/members/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'

export default function AddRevueGroupMember({ groupId }: { groupId: number }) {
    const editable = useEditMode({ authorizer: revueGroupMemberAuth.create })
    const popUpKey = `AddRevueGroupMember${groupId}`

    if (!editable) return null
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                flex items-center justify-center gap-2 w-full p-4 mt-4 border border-dashed border-surface-subtle
                bg-transparent text-text-muted cursor-pointer transition-colors
                hover:bg-surface-hover
            "
            showButtonContent={<>
                <FontAwesomeIcon icon={faPlus} />
                Legg til medlem
            </>}
        >
            <RevueGroupMemberForm
                title="Nytt medlem"
                submitText="Legg til"
                popUpKey={popUpKey}
                action={configureAction(createRevueGroupMemberAction, { params: { groupId } })}
            />
        </PopUp>
    )
}
