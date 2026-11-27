import { careerJobAdPages } from '@/app/(careers)/career/job-ads/config'
import JobAd from '@/components/JobAds/JobAd'
import type { SimpleJobAd } from '@/services/careers/jobAds/types'

type PropTypes = {
    jobAds: SimpleJobAd[],
}

/** The company's job ads, the active ones apart from the archived, each linked to on the career site. */
export default function CompanyJobAds({ jobAds }: PropTypes) {
    if (!jobAds.length) return null
    const active = jobAds.filter(jobAd => jobAd.active)
    const archived = jobAds.filter(jobAd => !jobAd.active)

    return (
        <section className="
            flex flex-col gap-4 p-8 bg-base-200 border border-careers-line
            max-mobile:p-6
        ">
            <h2 className="text-l text-careers-navy">Jobbannonser</h2>
            {active.length > 0 && <>
                <h3 className="text-m">Aktive</h3>
                <div className="row-list">
                    {active.map(jobAd => <JobAd key={jobAd.id} jobAd={jobAd} config={careerJobAdPages} />)}
                </div>
            </>}
            {archived.length > 0 && <>
                <h3 className="text-m">Arkiverte</h3>
                <div className="row-list">
                    {archived.map(jobAd => <JobAd key={jobAd.id} jobAd={jobAd} config={careerJobAdPages} />)}
                </div>
            </>}
        </section>
    )
}
