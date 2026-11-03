import { companyPresentationPages } from '@/app/(careers)/career/company-presentations/config'
import { eventAttendancePage } from '@/pageKits/events/pages/EventAttendancePage'

const { page, generateMetadata } = eventAttendancePage(companyPresentationPages)

export default page
export { generateMetadata }
