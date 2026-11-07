'use client'
import Form from '@/components/Form/Form'
import { SelectString } from '@/components/UI/Select'
import TextInput from '@/components/UI/TextInput'
import UserList from '@/components/User/UserList/UserList'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import UserSelectionProvider, { UserSelectionContext } from '@/contexts/UserSelection'
import useAuthorizer from '@/hooks/useAuthorizer'
import { userAuth } from '@/services/users/auth'
import { useContext, useState } from 'react'
import type { ActionFormData } from '@/services/actionTypes'
import type { ExpandedRevueGroupMember } from '@/services/revue/groups/types'

type PropTypes<Return> = {
    title: string,
    submitText: string,
    popUpKey: string,
    action: ActionFormData<Return>,
    member?: ExpandedRevueGroupMember,
}

function MemberForm<Return>({ title, submitText, popUpKey, action, member }: PropTypes<Return>) {
    // Without access to the user list there is no selection, so only the user the member already has can be kept.
    const selection = useContext(UserSelectionContext)
    const user = selection ? selection.user : member?.user ?? null
    const canBeUser = Boolean(selection ?? member?.user)
    const [type, setType] = useState<string>(member?.type ?? (canBeUser ? 'USER' : 'DETAILS'))

    return (
        <>
            <Form title={title} submitText={submitText} action={action} refreshOnSuccess closePopUpOnSuccess={popUpKey}>
                {canBeUser
                    ? <SelectString
                        name="type"
                        label="Type"
                        value={type}
                        onChange={setType}
                        options={[
                            { value: 'USER', label: 'Bruker på Omegaweb' },
                            { value: 'DETAILS', label: 'Bare navn' },
                        ]}
                    />
                    : <input type="hidden" name="type" value="DETAILS" />}
                {type === 'USER'
                    ? <input type="hidden" name="userId" value={user?.id ?? ''} />
                    : <TextInput name="name" label="Navn" defaultValue={member?.name} />}
                {type === 'USER' && <p>{user ? `${user.firstname} ${user.lastname}` : 'Ingen bruker valgt'}</p>}
            </Form>
            {type === 'USER' && selection && <UserList />}
        </>
    )
}

/** A member is either a user on Omegaweb, picked from the user list below the form, or just a name. */
export default function RevueGroupMemberForm<Return>(props: PropTypes<Return>) {
    const canReadUsers = useAuthorizer({ authorizer: userAuth.readPage }).authorized

    if (!canReadUsers) return <MemberForm {...props} />
    return (
        <div className="min-w-[70vw]">
            <UserPagingProvider
                serverRenderedData={[]}
                startPage={{ pageSize: 50, page: 0 }}
                details={{ groups: [], partOfName: '' }}
            >
                <UserSelectionProvider initialUser={props.member?.user}>
                    <MemberForm {...props} />
                </UserSelectionProvider>
            </UserPagingProvider>
        </div>
    )
}
