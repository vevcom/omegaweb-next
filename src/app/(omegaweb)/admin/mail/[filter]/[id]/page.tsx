import { omegaMailServerPages } from '@/app/(omegaweb)/admin/mail/config'
import { mailServerNodePage } from '@/pageKits/mailServer/pages/MailServerNodePage'

const { page, generateMetadata } = mailServerNodePage(omegaMailServerPages)

export default page
export { generateMetadata }
