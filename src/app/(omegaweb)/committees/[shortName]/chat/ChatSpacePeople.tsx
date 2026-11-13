'use client'
import Tag from '@/components/Chat/SpaceAdmin/Tag'
import AddUsersPopUp from '@/components/Chat/SpaceAdmin/AddUsersPopUp'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import type { ReactNode } from 'react'
import type { ChatSpaceAdminActions } from '@/services/chat/spaces/types'
import type { CommitteeChatSpacePerson } from '@/services/groups/committees/chatSpace'

type PropTypes = {
    spaceId: number,
    people: CommitteeChatSpacePerson[],
    actions: Pick<ChatSpaceAdminActions, 'addMembers' | 'removeMembers'>,
}

const nameOf = (person: CommitteeChatSpacePerson) => `${person.firstname} ${person.lastname}`

export default function ChatSpacePeople({ spaceId, people, actions }: PropTypes) {
    const { addMembers, removeMembers } = actions
    const ofSpace = { params: { spaceId } }
    const active = people.filter(person => person.standing === 'ACTIVE')
    const inactive = people
        .filter(person => person.standing === 'INACTIVE')
        .sort((one, other) => (other.latestOrder ?? 0) - (one.latestOrder ?? 0))
    const outside = people.filter(person => person.standing === 'OUTSIDE')

    const removeButton = (person: CommitteeChatSpacePerson) => removeMembers && (
        <Form
            className="w-auto!"
            submitText="Fjern"
            submitColor="red"
            action={configureAction(removeMembers, ofSpace)}
            refreshOnSuccess
            confirmation={{ confirm: true, text: `Fjerne ${nameOf(person)} fra chatområdet og rommene i det?` }}
        >
            <input type="hidden" name="userIds" value={person.id} />
        </Form>
    )
    const addButton = (person: CommitteeChatSpacePerson) => addMembers && (
        <Form
            className="w-auto!"
            submitText="Legg til"
            submitColor="secondary"
            action={configureAction(addMembers, ofSpace)}
            refreshOnSuccess
        >
            <input type="hidden" name="userIds" value={person.id} />
        </Form>
    )

    return (
        <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2>Aktive medlemmer</h2>
                <p className="text-base-content/80">
                    Aktive medlemmer av komiteen er med i chatområdet av seg selv, fra de har logget inn på chatten
                    første gang. De kan ikke fjernes her.
                </p>
                {active.map(person => (
                    <PersonRow key={person.id} name={nameOf(person)}>
                        {activeStatusOf(person)}
                    </PersonRow>
                ))}
            </div>

            {inactive.length > 0 && (
                <div className="flex flex-col gap-2">
                    <h2>Tidligere medlemmer</h2>
                    <p className="text-base-content/80">
                        Den som slutter i komiteen blir værende i chatområdet til noen fjerner dem.
                    </p>
                    {inactive.map(person => (
                        <PersonRow key={person.id} name={nameOf(person)} detail={`Orden ${person.latestOrder}`}>
                            {person.isInSpace && removeButton(person)}
                            {!person.isInSpace && person.hasChatAccount && addButton(person)}
                            {!person.isInSpace && !person.hasChatAccount && <Tag>Har ikke logget inn på chatten</Tag>}
                        </PersonRow>
                    ))}
                </div>
            )}

            {(addMembers !== undefined || outside.length > 0) && (
                <div className="flex flex-col gap-2">
                    <h2>Utenfor komiteen</h2>
                    {addMembers && (
                        <AddUsersPopUp
                            spaceId={spaceId}
                            addUsers={addMembers}
                            buttonText="Inviter fra utsiden av komiteen"
                            whoCanBeAdded="Bare de som har logget inn på chatten kan legges til."
                        />
                    )}
                    {outside.map(person => (
                        <PersonRow key={person.id} name={nameOf(person)}>
                            {removeButton(person)}
                        </PersonRow>
                    ))}
                </div>
            )}
        </section>
    )
}

function activeStatusOf(person: CommitteeChatSpacePerson): ReactNode {
    if (person.isInSpace) return <Tag>I chatområdet</Tag>
    if (person.hasChatAccount) return <Tag>Legges til om litt</Tag>
    return <Tag>Har ikke logget inn på chatten ennå</Tag>
}

function PersonRow({ name, detail, children }: { name: string, detail?: string, children: ReactNode }) {
    return (
        <div className="
            flex flex-row items-center gap-4 py-2 px-4 rounded-round layer
            [&_form>*:last-child]:mt-0
        ">
            <span className="grow truncate">{name}</span>
            {detail && <span className="text-base-content/80 text-s">{detail}</span>}
            {children}
        </div>
    )
}
