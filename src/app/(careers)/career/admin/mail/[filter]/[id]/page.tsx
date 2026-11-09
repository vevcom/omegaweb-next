import { careerMailServerPages } from '@/app/(careers)/career/admin/mail/config'
import { mailServerNodePage } from '@/pageKits/mailServer/pages/MailServerNodePage'

const { page, generateMetadata } = mailServerNodePage(careerMailServerPages)

export default page
export { generateMetadata }
