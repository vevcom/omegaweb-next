import { companyPresentationPages } from '@/app/(careers)/_lib/careersSite'
import { eventPage } from '@/pageKits/events/EventPage'

const { page, generateMetadata } = eventPage(companyPresentationPages)

export default page
export { generateMetadata }
