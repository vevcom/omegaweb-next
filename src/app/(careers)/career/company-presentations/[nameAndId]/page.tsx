import { companyPresentationPages } from '@/app/(careers)/_lib/careersSite'
import { eventPage } from '@/components/Event/Pages/EventPage'

const { page, generateMetadata } = eventPage(companyPresentationPages)

export default page
export { generateMetadata }
