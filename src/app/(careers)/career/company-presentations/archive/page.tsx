import { companyPresentationPages } from '@/app/(careers)/_lib/careersSite'
import { eventsArchivePage } from '@/components/Event/Pages/EventsArchivePage'

const { page, generateMetadata } = eventsArchivePage(companyPresentationPages)

export default page
export { generateMetadata }
