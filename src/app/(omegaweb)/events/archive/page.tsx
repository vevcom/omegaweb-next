import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import { eventsArchivePage } from '@/pageKits/events/pages/EventsArchivePage'

const { page, generateMetadata } = eventsArchivePage(omegaEventPages)

export default page
export { generateMetadata }
