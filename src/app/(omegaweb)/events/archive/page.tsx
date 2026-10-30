import { omegaEventPages } from '@/app/(omegaweb)/events/omegaEventPages'
import { eventsArchivePage } from '@/components/Event/Pages/EventsArchivePage'

const { page, generateMetadata } = eventsArchivePage(omegaEventPages)

export default page
export { generateMetadata }
