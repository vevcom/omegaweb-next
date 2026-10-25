import { CAREER_PATH } from '@/app/(careers)/_lib/careersSite'
import JobAdsArchivePage from '@/components/JobAds/Pages/JobAdsArchivePage'

export default function JobAdsArchive() {
    return <JobAdsArchivePage basePath={`${CAREER_PATH}/job-ads`} />
}
