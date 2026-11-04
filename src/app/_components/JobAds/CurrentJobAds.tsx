import JobAd from './JobAd'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import { withPageSession } from '@/app/ServerPage'
import type { JobAdPagesConfig } from '@/pageKits/jobAds/config'

type PropTypes = {
    config: JobAdPagesConfig
    not?: number
}

/**
 * @param not - pass it not: a id of a jobad to exclude from the list
 */
export default async function CurrentJobAds({ config, not }: PropTypes) {
    const activeJobAds = await withPageSession(() => jobAdOperations.readActive({}))
    const jobAds = activeJobAds.filter(jobAd => jobAd.id !== not)

    return (
        jobAds.length ? (
            jobAds.map(jobAd =>
                <JobAd jobAd={jobAd} config={config} key={jobAd.id} />
            )
        ) : (
            <i>Det er for tiden ingen jobbannonser</i>
        )
    )
}
