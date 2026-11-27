import { speedInterviewPages } from '@/app/(careers)/career/speed-interviews/config'
import { eventPage } from '@/pageKits/events/pages/EventPage'

const { page, generateMetadata } = eventPage(speedInterviewPages)

export default page
export { generateMetadata }
