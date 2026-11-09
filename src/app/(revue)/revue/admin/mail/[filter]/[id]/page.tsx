import { revueMailServerPages } from '@/app/(revue)/revue/admin/mail/config'
import { mailServerNodePage } from '@/pageKits/mailServer/pages/MailServerNodePage'

const { page, generateMetadata } = mailServerNodePage(revueMailServerPages)

export default page
export { generateMetadata }
