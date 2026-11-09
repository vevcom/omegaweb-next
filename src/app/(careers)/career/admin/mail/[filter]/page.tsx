import { careerMailServerPages } from '@/app/(careers)/career/admin/mail/config'
import { mailServerPartPage } from '@/pageKits/mailServer/pages/MailServerPartPage'

const { page, generateMetadata } = mailServerPartPage(careerMailServerPages)

export default page
export { generateMetadata }
