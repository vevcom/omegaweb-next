import { speedInterviewPages } from '@/app/(careers)/career/speed-interviews/config'
import { eventAttendancePage } from '@/pageKits/events/pages/EventAttendancePage'

const { page, generateMetadata } = eventAttendancePage(speedInterviewPages)

export default page
export { generateMetadata }
