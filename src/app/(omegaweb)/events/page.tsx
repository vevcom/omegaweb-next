import { omegaEventPages } from '@/app/(omegaweb)/events/omegaEventPages'
import { eventsPage } from '@/pageKits/events/EventsPage'

const { page, generateMetadata } = eventsPage(omegaEventPages)

export default page
export { generateMetadata }
