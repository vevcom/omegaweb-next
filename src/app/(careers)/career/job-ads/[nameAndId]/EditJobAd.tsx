'use client'
import SelectedCompany from '@/career/job-ads/SelectedCompany'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import Textarea from '@/components/UI/Textarea'
import { SelectString } from '@/components/UI/Select'
import DateInput from '@/components/UI/DateInput'
import Slider from '@/app/_components/UI/Slider'
import { CompanyPagingContext } from '@/contexts/paging/CompanyPaging'
import CompanyChooser from '@/career/job-ads/CompanyChooser'
import { destroyJobAdAction, updateJobAdAction } from '@/career/jobAds/actions'
import { jobAdOptions } from '@/services/career/jobAds/constants'
import useEditMode from '@/hooks/useEditMode'
import useAuthorizer from '@/hooks/useAuthorizer'
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
const columnClassName = `
    flex flex-col gap-2 min-h-0 min-w-0
    mobile:max-h-[calc(80vh-6*var(--gap))]
`
const headingClassName = 'text-s font-medium uppercase tracking-[0.06em] text-text-muted shrink-0'

export default function EditJobAd({ jobAd, children }: PropTypes) {
    const canEdit = useEditMode({
        authorizer: jobAdAuth.update
    })
    const canDestroy = useAuthorizer({ authorizer: jobAdAuth.destroy }).authorized
    const companyPagingCtx = useContext(CompanyPagingContext)
    if (!canEdit) return children
    if (!companyPagingCtx) {
        throw new Error('CompanySelectionContext eller companyPaging er ikke definert')
    }

    const updateAction = configureAction(updateJobAdAction, { params: { id: jobAd.id } })

    return (
        <div
            className="
                shrink-0 max-h-[80vh] grid gap-6 p-6 my-4 mx-[min(4rem,4vw)] rounded-round bg-surface-raised text-text
                mobile:grid-cols-[minmax(240px,320px)_1fr] mobile:items-start
                max-mobile:grid-cols-1 max-mobile:mx-2 max-mobile:max-h-none
            "
        >
            <div className={columnClassName}>
                <h3 className={headingClassName}>Annonse</h3>
                <div className="
                    flex-1 min-h-0 overflow-y-auto pr-2
                    [&_form]:m-0!
                ">
                    <Form
                        action={updateAction}
                        navigateOnSuccess={(data) =>
                            `/career/job-ads/${data ? formatVevenUri(data.articleName, data.id) : ''}`
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
                            defaultValue={jobAd.applicationDeadline ?? ''}
                        />
                        <Slider
                            label="Aktiv"
                            name="active"
                            defaultChecked={jobAd.active}
                            color="primary"
                        />
                    </Form>
                    {canDestroy && (
                        <div className="mt-4 pt-4 border-t border-surface-hover">
                            <Form
                                action={configureAction(destroyJobAdAction, { params: { id: jobAd.id } })}
                                navigateOnSuccess="/career/job-ads"
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
                    )}
                </div>
            </div>
            <div className={columnClassName}>
                <h3 className={headingClassName}>Arbeidsgiver</h3>
                <CompanyChooser className="
                    flex-1 min-h-0
                    max-mobile:max-h-[50vh]
                " />
            </div>
        </div>
    )
}
