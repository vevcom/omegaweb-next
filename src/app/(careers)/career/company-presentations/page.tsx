import { companyPresentationPages } from '@/app/(careers)/career/company-presentations/config'
import { eventsPage } from '@/pageKits/events/pages/EventsPage'

const { page, generateMetadata } = eventsPage(companyPresentationPages)

export default page
export { generateMetadata }
