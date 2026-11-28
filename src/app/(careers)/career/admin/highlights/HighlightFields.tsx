'use client'
import { displayDate } from '@/lib/dates/displayDate'
import type { CreateHighlightField } from './highlightSubmitters'
import type {
    CareerFrontpageHighlightTargets,
    ExpandedCareerFrontpageHighlight,
} from '@/services/careers/frontpage/highlights/types'

type PropTypes = {
    /** The field of the submitter around these, since creating and updating take the same values. */
    Field: typeof CreateHighlightField,
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
export default function HighlightFields({ Field, targets, highlight }: PropTypes) {
    const events = withCurrent(targets.events, highlight?.event)
    const jobAds = withCurrent(targets.jobAds, highlight?.jobAd)
    return (
        <>
            <Field
                kind="select"
                name="eventId"
                label="Bedriftspresentasjon"
                options={[
                    { value: null, label: 'Ingen' },
                    ...events.map(event => ({
                        value: event.id,
                        label: `${event.name} (${displayDate(event.eventStart, false)})`,
                    })),
                ]}
            />
            <Field
                kind="select"
                name="jobAdId"
                label="Jobbannonse"
                options={[
                    { value: null, label: 'Ingen' },
                    ...jobAds.map(jobAd => ({
                        value: jobAd.id,
                        label: `${jobAd.articleName} (${jobAd.company.name})`,
                    })),
                ]}
            />
            <Field kind="date" name="start" label="Start" includeTime />
            <Field kind="date" name="end" label="Slutt" includeTime />
        </>
    )
}
