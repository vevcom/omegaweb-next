'use client'
import styles from './CreateUpdateApplicationPeriodForm.module.scss'
import { createApplicationPeriodAction, updateApplicationPeriodAction } from '@/services/applications/periods/actions'
import { configureAction } from '@/services/configureAction'
import Form from '@/components/Form/Form'
import Checkbox from '@/components/UI/Checkbox'
import DateInput from '@/components/UI/DateInput'
import TextInput from '@/components/UI/TextInput'
import type { ExpandedApplicationPeriod } from '@/services/applications/periods/types'
import type { ExpandedCommittee } from '@/services/groups/committees/types'

type PropTypes = {
    committees: ExpandedCommittee[]
    period?: ExpandedApplicationPeriod
    closePopUpOnSuccess: string
}

export default function CreateUpdateApplicationPeriodForm({ committees, period, closePopUpOnSuccess }: PropTypes) {
    return (
        <Form
            title={period ? `Oppdater søknadsperiode: ${period.name}` : 'Legg til ny søknadsperiode'}
            action={
                period
                    ? configureAction(updateApplicationPeriodAction, { params: { name: period.name } })
                    : createApplicationPeriodAction
            }
            submitText={period ? 'Oppdater' : 'Lag'}
            refreshOnSuccess
            className={styles.CreateUpdateApplicationPeriodForm}
            closePopUpOnSuccess={closePopUpOnSuccess}
            navigateOnSuccess={data => (data?.name ? `/applications/${encodeURIComponent(data.name)}` : null)}
        >
            <TextInput name="name" label="Navn" defaultValue={period ? period.name : undefined} />
            <DateInput
                name="startDate"
                label="Starttid"
                includeTime
                defaultValue={period ? period.startDate : undefined} />
            <DateInput
                name="endDate"
                label="Sluttid"
                includeTime
                defaultValue={period ? period.endDate : undefined}
            />
            <DateInput
                name="endPriorityDate"
                label="Frist for prioritering"
                includeTime
                defaultValue={period ? period.endPriorityDate : undefined}
            />
            <h3>Kommitéer som deltar i søknadsperioden</h3>
            {period && <p className={styles.warning}>Fjerner man en komité vil det slette alle søknadene til komitéen!</p>}
            {
                committees.map(committee => (
                    <Checkbox
                        key={committee.id}
                        name="participatingCommitteeIds"
                        value={committee.id}
                        label={committee.name}
                        defaultChecked={period ? period.committeesParticipating.some(
                            cp => cp.committee.id === committee.id
                        ) : false}
                    />
                ))
            }
        </Form>
    )
}
