import { companyPresentationPages } from '@/app/(careers)/career/company-presentations/config'
import { eventPage } from '@/pageKits/events/pages/EventPage'

const { page, generateMetadata } = eventPage(companyPresentationPages)

export default page
export { generateMetadata }
