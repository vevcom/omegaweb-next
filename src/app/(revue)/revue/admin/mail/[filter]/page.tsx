import { revueMailServerPages } from '@/app/(revue)/revue/admin/mail/config'
import { mailServerPartPage } from '@/pageKits/mailServer/pages/MailServerPartPage'

const { page, generateMetadata } = mailServerPartPage(revueMailServerPages)

export default page
export { generateMetadata }
