import { companyPresentationPages } from '@/app/(careers)/career/company-presentations/config'
import { eventsArchivePage } from '@/pageKits/events/pages/EventsArchivePage'

const { page, generateMetadata } = eventsArchivePage(companyPresentationPages)

export default page
export { generateMetadata }
