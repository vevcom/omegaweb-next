import { omegaEventPages } from '@/app/(omegaweb)/events/omegaEventPages'
import { eventsPage } from '@/components/Event/Pages/EventsPage'

const { page, generateMetadata } = eventsPage(omegaEventPages)

export default page
export { generateMetadata }
