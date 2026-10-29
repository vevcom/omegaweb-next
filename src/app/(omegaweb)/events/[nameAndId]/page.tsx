import { omegaEventPages } from '@/app/(omegaweb)/events/omegaEventPages'
import { eventPage } from '@/components/Event/Pages/EventPage'

const { page, generateMetadata } = eventPage(omegaEventPages)

export default page
export { generateMetadata }
