import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import { eventsPage } from '@/pageKits/events/pages/EventsPage'

const { page, generateMetadata } = eventsPage(omegaEventPages)

export default page
export { generateMetadata }
