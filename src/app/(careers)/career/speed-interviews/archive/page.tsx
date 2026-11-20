import { speedInterviewPages } from '@/app/(careers)/career/speed-interviews/config'
import { eventsArchivePage } from '@/pageKits/events/pages/EventsArchivePage'

const { page, generateMetadata } = eventsArchivePage(speedInterviewPages)

export default page
export { generateMetadata }
