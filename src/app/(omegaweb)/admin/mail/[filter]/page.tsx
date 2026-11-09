import { omegaMailServerPages } from '@/app/(omegaweb)/admin/mail/config'
import { mailServerPartPage } from '@/pageKits/mailServer/pages/MailServerPartPage'

const { page, generateMetadata } = mailServerPartPage(omegaMailServerPages)

export default page
export { generateMetadata }
