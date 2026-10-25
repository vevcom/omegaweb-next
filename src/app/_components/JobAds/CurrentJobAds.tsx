import JobAd from './JobAd'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import { withPageSession } from '@/app/ServerPage'

type PropTypes = {
    basePath: string
    not?: number
}

/**
 * @param not - pass it not: a id of a jobad to exclude from the list
 */
export default async function CurrentJobAds({ basePath, not }: PropTypes) {
    const activeJobAds = await withPageSession(() => jobAdOperations.readActive({}))
    const jobAds = activeJobAds.filter(jobAd => jobAd.id !== not)

    return (
        jobAds.length ? (
            jobAds.map(jobAd =>
                <JobAd jobAd={jobAd} basePath={basePath} key={jobAd.id} />
            )
        ) : (
            <i>Det er for tiden ingen jobbannonser</i>
        )
    )
}
