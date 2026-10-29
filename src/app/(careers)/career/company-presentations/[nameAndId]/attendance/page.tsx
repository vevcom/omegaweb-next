import { companyPresentationPages } from '@/app/(careers)/_lib/careersSite'
import { eventAttendancePage } from '@/components/Event/Pages/EventAttendancePage'

const { page, generateMetadata } = eventAttendancePage(companyPresentationPages)

export default page
export { generateMetadata }
