'use client'
import Form from '@/components/Form/Form'
import DateInput from '@/components/UI/DateInput'
import { SelectNumberPossibleNULL } from '@/components/UI/Select'
import { displayDate } from '@/lib/dates/displayDate'
import type { ComponentProps } from 'react'
import type {
    CareerFrontpageHighlightTargets,
    ExpandedCareerFrontpageHighlight,
} from '@/services/careers/frontpage/highlights/types'

type PropTypes = Pick<ComponentProps<typeof Form>, 'action' | 'title' | 'submitText' | 'closePopUpOnSuccess'> & {
    targets: CareerFrontpageHighlightTargets,
    highlight?: ExpandedCareerFrontpageHighlight,
}

/** A highlight of either an event or a job ad, the other left as none. */
export default function HighlightForm({ targets, highlight, ...formProps }: PropTypes) {
    return (
        <Form refreshOnSuccess {...formProps}>
            <SelectNumberPossibleNULL
                label="Bedriftspresentasjon"
                name="eventId"
                options={[
                    { value: 'NULL', label: 'Ingen' },
                    ...targets.events.map(event => ({
                        value: event.id,
                        label: `${event.name} (${displayDate(event.eventStart, false)})`,
                    })),
                ]}
                defaultValue={highlight?.event?.id ?? 'NULL'}
            />
            <SelectNumberPossibleNULL
                label="Jobbannonse"
                name="jobAdId"
                options={[
                    { value: 'NULL', label: 'Ingen' },
                    ...targets.jobAds.map(jobAd => ({
                        value: jobAd.id,
                        label: `${jobAd.articleName} (${jobAd.company.name})`,
                    })),
                ]}
                defaultValue={highlight?.jobAd?.id ?? 'NULL'}
            />
            <DateInput label="Start" name="start" includeTime defaultValue={highlight?.start} />
            <DateInput label="Slutt" name="end" includeTime defaultValue={highlight?.end} />
        </Form>
    )
}
