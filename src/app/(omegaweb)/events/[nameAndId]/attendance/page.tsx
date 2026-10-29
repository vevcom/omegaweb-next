import { omegaEventPages } from '@/app/(omegaweb)/events/omegaEventPages'
import { eventAttendancePage } from '@/components/Event/Pages/EventAttendancePage'

const { page, generateMetadata } = eventAttendancePage(omegaEventPages)

export default page
export { generateMetadata }
