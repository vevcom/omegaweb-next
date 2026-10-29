import { companyPresentationPages } from '@/app/(careers)/_lib/careersSite'
import { eventsPage } from '@/components/Event/Pages/EventsPage'

const { page, generateMetadata } = eventsPage(companyPresentationPages)

export default page
export { generateMetadata }
