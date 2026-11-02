import { omegaEventPages } from '@/app/(omegaweb)/events/omegaEventPages'
import { eventAttendancePage } from '@/pageKits/events/EventAttendancePage'

const { page, generateMetadata } = eventAttendancePage(omegaEventPages)

export default page
export { generateMetadata }
