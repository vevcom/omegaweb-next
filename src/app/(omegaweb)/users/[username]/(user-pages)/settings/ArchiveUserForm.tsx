'use client'
import Form from '@/components/Form/Form'
import { configureAction } from '@/services/configureAction'
import { archiveUserAction } from '@/services/users/actions'

type PropTypes = {
    userId: number,
    ownAccount: boolean,
}

/**
 * Archives the user, which shuts them out of the site until an admin lets them back in. Archiving
 * your own account ends your session, so it leads to the logout page.
 */
export default function ArchiveUserForm({ userId, ownAccount }: PropTypes) {
    return (
        <Form
            title="Arkiver bruker"
            action={configureAction(archiveUserAction, { params: { id: userId } })}
            submitText={ownAccount ? 'Arkiver kontoen min' : 'Arkiver brukeren'}
            submitColor="red"
            navigateOnSuccess={ownAccount ? '/logout' : '/admin/users/archived'}
            confirmation={{
                confirm: true,
                text: ownAccount
                    ? 'Er du sikker på at du vil arkivere kontoen din? Du kan ikke logge inn igjen, '
                        + 'og bare en administrator kan åpne den igjen.'
                    : 'Er du sikker på at du vil arkivere brukeren? De kan ikke logge inn igjen før '
                        + 'en administrator åpner kontoen igjen.',
            }}
        >
            <p>
                En arkivert bruker kan ikke logge inn, får ingen e-post eller varsler, og vises ikke i
                brukerlister. Dataene beholdes, og en administrator kan åpne kontoen igjen.
            </p>
        </Form>
    )
}
