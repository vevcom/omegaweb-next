import { omegaEventPages } from '@/app/(omegaweb)/events/omegaEventPages'
import { eventPage } from '@/pageKits/events/EventPage'

const { page, generateMetadata } = eventPage(omegaEventPages)

export default page
export { generateMetadata }
