import { companyPresentationPages } from '@/app/(careers)/_lib/careersSite'
import { eventsArchivePage } from '@/pageKits/events/EventsArchivePage'

const { page, generateMetadata } = eventsArchivePage(companyPresentationPages)

export default page
export { generateMetadata }
