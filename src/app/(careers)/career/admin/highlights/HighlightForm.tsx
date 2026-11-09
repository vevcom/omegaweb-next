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

/**
 * The targets offered, with the current one kept: an event that has ended or a job ad gone inactive is no
 * longer offered anew, but must stay selectable so the dates can be edited without losing it.
 */
function withCurrent<T extends { id: number }>(offered: T[], current: T | null | undefined): T[] {
    if (!current || offered.some(target => target.id === current.id)) return offered
    return [...offered, current]
}

/** A highlight of either an event or a job ad, the other left as none. */
export default function HighlightForm({ targets, highlight, ...formProps }: PropTypes) {
    const events = withCurrent(targets.events, highlight?.event)
    const jobAds = withCurrent(targets.jobAds, highlight?.jobAd)
    return (
        <Form refreshOnSuccess {...formProps}>
            <SelectNumberPossibleNULL
                label="Bedriftspresentasjon"
                name="eventId"
                options={[
                    { value: 'NULL', label: 'Ingen' },
                    ...events.map(event => ({
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
                    ...jobAds.map(jobAd => ({
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
