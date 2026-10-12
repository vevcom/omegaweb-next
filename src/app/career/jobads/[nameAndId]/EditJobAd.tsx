'use client'
import styles from './EditJobAd.module.scss'
import SelectedCompany from '@/career/jobads/SelectedCompany'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import { SelectString } from '@/components/UI/Select'
import DateInput from '@/components/UI/DateInput'
import Slider from '@/app/_components/UI/Slider'
import { CompanyPagingContext } from '@/contexts/paging/CompanyPaging'
import CompanyChooser from '@/app/career/jobads/CompanyChooser'
import { destroyJobAdAction, updateJobAdAction } from '@/career/jobAds/actions'
import { jobAdOptions } from '@/services/career/jobAds/constants'
import useEditMode from '@/hooks/useEditMode'
import { jobAdAuth } from '@/services/career/jobAds/auth'
import { configureAction } from '@/services/configureAction'
import { formatVevenUri } from '@/lib/urlEncoding'
import { useContext, type ReactNode } from 'react'
import type { ExpandedJobAd } from '@/services/career/jobAds/types'

type PropTypes = {
    jobAd: ExpandedJobAd
    children?: ReactNode
}

/**
 * This component renders children if editmode is off and news admin tools if editmode is on
 * pass it not: id of jobad to make sure not to display that jobad
 * @param jobAd - the jobad to edit
 * @param children - children to render if editmode is off
 */
export default function EditJobAd({ jobAd, children }: PropTypes) {
    const canEdit = useEditMode({
        authorizer: jobAdAuth.update
    })
    const companyPagingCtx = useContext(CompanyPagingContext)
    if (!canEdit) return children
    if (!companyPagingCtx) {
        throw new Error('CompanySelectionContext eller companyPaging er ikke definert')
    }

    const updateAction = configureAction(updateJobAdAction, { params: { id: jobAd.id } })

    return (
        <div className={styles.EditJobAd}>
            <div className={styles.column}>
                <h3 className={styles.heading}>Annonse</h3>
                <div className={styles.update}>
                    <Form
                        action={updateAction}
                        navigateOnSuccess={(data) =>
                            `/career/jobads/${data ? formatVevenUri(data.articleName, data.id) : ''}`
                        }
                        submitText="Oppdater"
                    >
                        <Textarea
                            defaultValue={jobAd.description || ''}
                            label="Beskrivelse"
                            name="description"
                        />
                        <TextInput
                            defaultValue={jobAd.location || ''}
                            label="Sted"
                            name="location"
                        />
                        <SelectedCompany />
                        <SelectString
                            options={jobAdOptions}
                            label="Type"
                            name="type"
                            defaultValue={jobAd.type}
                        />
                        <DateInput
                            includeTime
                            label="Søknadsfrist"
                            name="applicationDeadline"
                            defaultValue={jobAd.applicationDeadline || ''}
                        />
                        <Slider
                            label="Aktiv"
                            name="active"
                            defaultChecked={jobAd.active}
                            color="primary"
                        />
                    </Form>
                    <div className={styles.destroy}>
                        <Form
                            action={configureAction(destroyJobAdAction, { params: { id: jobAd.id } })}
                            navigateOnSuccess="/career/jobads"
                            submitText="Slett annonse"
                            confirmation={{
                                confirm: true,
                                text: 'Er du sikker på at du vil slette denne annonsen? ' +
                                'Dette kan ikke angres. Vi anbefaler å sette annonsen ' +
                                'til inaktiv i stedet.'
                            }}
                            submitColor="red"
                        >
                        </Form>
                    </div>
                </div>
            </div>
            <div className={styles.column}>
                <h3 className={styles.heading}>Arbeidsgiver</h3>
                <CompanyChooser className={styles.companyChooser} />
            </div>
        </div>
    )
}
