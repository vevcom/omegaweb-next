import { companyPresentationPages } from '@/app/(careers)/_lib/careersSite'
import { eventAttendancePage } from '@/pageKits/events/pages/EventAttendancePage'

const { page, generateMetadata } = eventAttendancePage(companyPresentationPages)

export default page
export { generateMetadata }
