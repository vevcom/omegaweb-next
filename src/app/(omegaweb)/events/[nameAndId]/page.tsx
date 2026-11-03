import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import { eventPage } from '@/pageKits/events/pages/EventPage'

const { page, generateMetadata } = eventPage(omegaEventPages)

export default page
export { generateMetadata }
