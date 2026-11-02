import { omegaEventPages } from '@/app/(omegaweb)/events/omegaEventPages'
import { eventsArchivePage } from '@/pageKits/events/pages/EventsArchivePage'

const { page, generateMetadata } = eventsArchivePage(omegaEventPages)

export default page
export { generateMetadata }
