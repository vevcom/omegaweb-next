'use client'
import AddUsersPopUp from '@/components/Chat/SpaceAdmin/AddUsersPopUp'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import type { UsersOfSpaceAction } from '@/components/Chat/SpaceAdmin/AddUsersPopUp'

type Admin = { id: number, firstname: string, lastname: string }

type PropTypes = {
    spaceId: number,
    admins: Admin[],
    /** Left out for one who may not pick the admins. */
    actions?: {
        addAdmins: UsersOfSpaceAction,
        removeAdmins: UsersOfSpaceAction,
    },
}

export default function SpaceAdmins({ spaceId, admins, actions }: PropTypes) {
    return (
        <section className="flex flex-col gap-2">
            <h2>Styres av</h2>
            <p className="text-base-content/80">
                De som styrer chatområdet bestemmer rommene og medlemmene her, og kan fjerne meldinger og feste dem
                i rommene. De er selv med i chatområdet.
            </p>
            {actions && <AddUsersPopUp spaceId={spaceId} addUsers={actions.addAdmins} buttonText="Velg hvem som styrer" />}
            {admins.length === 0 && <p className="text-base-content/80 italic">Ingen styrer chatområdet ennå.</p>}
            {admins.map(admin => (
                <div
                    key={admin.id}
                    className="
                        flex flex-row items-center gap-4 py-2 px-4 rounded-round layer
                        [&_form>*:last-child]:mt-0
                    "
                >
                    <span className="grow truncate">{admin.firstname} {admin.lastname}</span>
                    {actions && (
                        <Form
                            className="w-auto!"
                            submitText="Fjern"
                            submitColor="red"
                            action={configureAction(actions.removeAdmins, { params: { spaceId } })}
                            refreshOnSuccess
                        >
                            <input type="hidden" name="userIds" value={admin.id} />
                        </Form>
                    )}
                </div>
            ))}
        </section>
    )
}
