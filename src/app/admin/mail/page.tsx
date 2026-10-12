import { redirect } from 'next/navigation'

// The mail admin is split into one page per part (see the admin nav) - the old combined page
// only forwards to the most central of them.
export default function MailSettings() {
    redirect('/admin/mail/mailingList')
}
