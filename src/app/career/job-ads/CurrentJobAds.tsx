import JobAd from './JobAd'
import { jobAdOperations } from '@/services/career/jobAds/operations'
import { withPageSession } from '@/app/serverPage'

type PropTypes = {
    not?: number
}

/**
 * @param not - pass it not: a id of a jobad to exclude from the list
 */
export default async function CurrentJobAds({ not }: PropTypes) {
    const activeJobAds = await withPageSession(() => jobAdOperations.readActive({}))
    const jobAds = activeJobAds.filter(jobAd => jobAd.id !== not)

    return (
        jobAds.length ? (
            jobAds.map(jobAd =>
                <JobAd jobAd={jobAd} key={jobAd.id} />
            )
        ) : (
            <i>Det er for tiden ingen jobbannonser</i>
        )
    )
}
