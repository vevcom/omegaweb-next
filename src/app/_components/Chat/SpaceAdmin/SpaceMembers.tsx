'use client'
import Tag from './Tag'
import AddMembersPopUp from './AddMembersPopUp'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import type { ChatSpaceAdminActions, ChatSpaceMemberOverview } from '@/services/chat/spaces/types'

type PropTypes = {
    spaceId: number,
    members: ChatSpaceMemberOverview[],
    actions: Pick<ChatSpaceAdminActions, 'addMembers' | 'removeMembers'>,
}

export default function SpaceMembers({ spaceId, members, actions }: PropTypes) {
    const { addMembers, removeMembers } = actions

    return (
        <section className="flex flex-col gap-2">
            <h2>Medlemmer</h2>
            {addMembers && <AddMembersPopUp spaceId={spaceId} addMembers={addMembers} buttonText="Legg til medlemmer" />}
            {members.length === 0 && <p className="text-base-content/80 italic">Chatområdet har ingen medlemmer.</p>}
            {members.map(member => {
                const name = `${member.firstname} ${member.lastname}`
                return (
                    <div
                        key={member.id}
                        className="
                            flex flex-row items-center gap-4 py-2 px-4 rounded-round layer
                            [&_form>*:last-child]:mt-0
                        "
                    >
                        <span className="grow truncate">{name}</span>
                        {!member.onHomeserver && <Tag>Venter på chatkonto</Tag>}
                        {removeMembers && (
                            <Form
                                className="w-auto!"
                                submitText="Fjern"
                                submitColor="red"
                                action={configureAction(removeMembers, { params: { spaceId } })}
                                refreshOnSuccess
                                confirmation={{ confirm: true, text: `Fjerne ${name} fra chatområdet og rommene i det?` }}
                            >
                                <input type="hidden" name="userIds" value={member.id} />
                            </Form>
                        )}
                    </div>
                )
            })}
        </section>
    )
}
