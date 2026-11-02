import { companyPresentationPages } from '@/app/(careers)/_lib/careersSite'
import { eventsPage } from '@/pageKits/events/pages/EventsPage'

const { page, generateMetadata } = eventsPage(companyPresentationPages)

export default page
export { generateMetadata }
