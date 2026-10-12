import styles from './page.module.scss'
import { ServerSession } from '@/auth/session/ServerSession'
import OmegaId from '@/components/OmegaId/identification/OmegaId'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { forbidden, notFound, redirect } from 'next/navigation'
import type { PropTypes } from '@/app/users/[username]/page'


export default async function OmegaIdPage({ params }: PropTypes) {
    const session = await ServerSession.fromNextAuth()
    const username = (await params).username

    if (!session.user) return notFound()

    if (username === 'me') {
        redirect(`/users/${session.user.username}/omegaid`)
    }

    if (username !== session.user.username) {
        forbidden()
    }

    return <div className={styles.wrapper}>
        <PageTitleSetter title={'OmegaId'} />
        <OmegaId />
    </div>
}
