'use client'
import RevueGroupMemberForm from './RevueGroupMemberForm'
import Form from '@/components/Form/Form'
import PopUp from '@/components/PopUp/PopUp'
import useEditMode from '@/hooks/useEditMode'
import { configureAction } from '@/services/configureAction'
import {
    destroyRevueGroupMemberAction,
    updateRevueGroupMemberAction,
} from '@/services/revue/groups/members/actions'
import { revueGroupMemberAuth } from '@/services/revue/groups/members/auth'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import type { ExpandedRevueGroupMember } from '@/services/revue/groups/types'

export default function RevueGroupMemberEditor({ member }: { member: ExpandedRevueGroupMember }) {
    const editable = useEditMode({ authorizer: revueGroupMemberAuth.update })
    const popUpKey = `EditRevueGroupMember${member.id}`
    const params = { params: { memberId: member.id } }

    if (!editable) return null
    return (
        <PopUp
            popUpKey={popUpKey}
            showButtonClass="
                p-1 text-base-content/80 bg-transparent border-none cursor-pointer
                hover:text-base-content
            "
            showButtonContent={<FontAwesomeIcon icon={faPencil} />}
            ariaLabel={`Rediger ${member.name}`}
        >
            <div className="flex flex-col gap-8">
                <RevueGroupMemberForm
                    title="Rediger medlem"
                    submitText="Lagre"
                    popUpKey={popUpKey}
                    action={configureAction(updateRevueGroupMemberAction, params)}
                    member={member}
                />
                <Form
                    action={configureAction(destroyRevueGroupMemberAction, params)}
                    submitText="Fjern medlem"
                    submitColor="red"
                    refreshOnSuccess
                    closePopUpOnSuccess={popUpKey}
                    confirmation={{
                        confirm: true,
                        text: `Vil du fjerne ${member.name}?`,
                    }}
                />
            </div>
        </PopUp>
    )
}
