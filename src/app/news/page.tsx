import styles from './page.module.scss'
import AddNews from './AddNews'
import CurrentNews from './CurrentNews'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'

export default async function NewsArtilces() {
    //TODO: add can create news permission
    const canCreateNews = true //temp

    return (
        <PageWrapper
            headerItem={
                <div className={styles.head}>
                    <ArchiveLink href="news/archive" />
                    {
                        canCreateNews && (
                            <AddHeaderItemPopUp popUpKey="createNewsPop">
                                <AddNews />
                            </AddHeaderItemPopUp>
                        )
                    }
                </div>
            }
        >
            <PageTitleSetter title="Nyheter" />
            <main className={styles.wrapper}>
                <CurrentNews />
            </main>
        </PageWrapper>
    )
}
