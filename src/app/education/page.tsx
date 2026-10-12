import styles from './page.module.scss'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { readStandardImageAction } from '@/services/images/standard/actions'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import ImageCard from '@/components/ImageCard/ImageCard'
import { configureAction } from '@/services/configureAction'

export default async function education() {
    const hovedbyggningenRes = await configureAction(readStandardImageAction, {
        params: {
            standardImage: 'HOVEDBYGGNINGEN'
        }
    })()
    const BooksRes = await configureAction(readStandardImageAction, {
        params: {
            standardImage: 'BOOKS'
        }
    })()

    const hovedbyggningen = hovedbyggningenRes.success ? hovedbyggningenRes.data : null
    const Books = BooksRes.success ? BooksRes.data : null

    return (
        <PageWrapper>
            <PageTitleSetter title="Fagveven" />
            <p>
                Velkommen til omegas fagvev! Her finner du nyttig info om emner og utveksling skrevet
                av studenter for studenter. Du kan også bidra selv ved å skrive om dine erfaringer
                fra utveksling eller emner du har tatt.
            </p>
            <div className={styles.links}>
                <ImageCard image={hovedbyggningen} title="Skoler" href="/education/schools">
                    <p>På fagveven kan du finne mange ulike skoler som man kan lese om</p>
                </ImageCard>
                <ImageCard image={Books} title="Emner" href="/education/courses">
                    <p>Her kan du lese om ulike emner som du kan ta både på NTNU og på utveksling</p>
                </ImageCard>
            </div>
        </PageWrapper>
    )
}
