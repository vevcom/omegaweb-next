import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import { eventAttendancePage } from '@/pageKits/events/pages/EventAttendancePage'

const { page, generateMetadata } = eventAttendancePage(omegaEventPages)

export default page
export { generateMetadata }
