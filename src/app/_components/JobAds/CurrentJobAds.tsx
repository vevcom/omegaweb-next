import JobAd from './JobAd'
import type { SimpleJobAd } from '@/services/careers/jobAds/types'
import type { JobAdPagesConfig } from '@/pageKits/jobAds/config'

type PropTypes = {
    jobAds: SimpleJobAd[]
    config: JobAdPagesConfig
}

export default function CurrentJobAds({ jobAds, config }: PropTypes) {
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
