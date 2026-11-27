import { speedInterviewPages } from '@/app/(careers)/career/speed-interviews/config'
import { eventsPage } from '@/pageKits/events/pages/EventsPage'

const { page, generateMetadata } = eventsPage(speedInterviewPages)

export default page
export { generateMetadata }
