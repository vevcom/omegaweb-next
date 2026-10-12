'use client'

import styles from './registration.module.scss'
import Form from '@/components/Form/Form'
import OmegaIdReader from '@/components/OmegaId/reader/OmegaIdReader'
import UserList from '@/components/User/UserList/UserList'
import { createAdmissionTrialAction } from '@/services/admission/actions'
import { configureAction } from '@/services/configureAction'
import { userAuth } from '@/services/users/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import type { Admission } from '@/prisma-generated-pn-types'


export default function RegisterAdmissiontrial({
    admission,
    omegaIdPublicKey,
}: {
    admission: Admission,
    omegaIdPublicKey: string,
}) {
    const canSearchUsers = useAuthorizer({ authorizer: userAuth.readPage }).authorized
    return <div className={styles.registration}>
        <h4>Registrer med QR kode</h4>
        <OmegaIdReader
            publicKey={omegaIdPublicKey}
            successCallback={async (userId) => {
                const results = await createAdmissionTrialAction({ params: { admission } }, { data: { userId } })

                let msg = results.success ?
                    `${results.data.user.firstname} ${results.data.user.lastname} er registrert` :
                    'Kunne ikke registrere bruker grunnet en ukjent feil.'

                if (!results.success && results.error) {
                    msg = results.error
                        .map(e => e.message)
                        .reduce((acc, val) => `${acc}\n${val}`, '')
                }

                return {
                    success: results.success,
                    text: msg,
                }
            }}
        />

        <h4>Søk opp soellen</h4>
        {canSearchUsers ? <>
            <p className={styles.lead}>
                Kun en soelle kan ta opptaksprøver. Filtrer på medlemskap for å finne dem.
            </p>
            {/* A button per row rather than a box to type an id into: who is being registered is then
                something that was looked up and read back, not something that was remembered. */}
            <UserList
                displayForUser={user => (
                    <Form
                        className={styles.registerForm}
                        submitText="Registrer"
                        submitColor="secondary"
                        refreshOnSuccess
                        action={configureAction(createAdmissionTrialAction, { params: { admission } })}
                    >
                        <input type="hidden" name="userId" value={user.id} />
                    </Form>
                )}
            />
        </> : (
            <p className={styles.lead}>
                Du mangler tilgangen «Les bruker», og kan derfor ikke søke opp soellen.
                Registrer med Omega-ID i stedet.
            </p>
        )}
    </div>
}
