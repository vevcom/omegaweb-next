import styles from './page.module.scss'
import ChangeName from './ChangeName'
import OmbulAdmin from './OmbulAdmin'
import { updateOmbulParagraphContentAction } from '@/services/ombul/actions'
import { ombulOperations } from '@/services/ombul/operations'
import PdfDocument from '@/components/PdfDocument/PdfDocument'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import Image from '@/components/Image/Image'
import PopUp from '@/components/PopUp/PopUp'
import { configureAction } from '@/services/configureAction'
import { ombulAuth } from '@/services/ombul/auth'
import { serverPage } from '@/app/serverPage'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ yearAndName: string[] }>) => {
        // Checked before decoding: a missing name segment would decode to the string 'undefined'.
        if (params.yearAndName.length !== 2) notFound()
        const year = parseInt(decodeURIComponent(params.yearAndName[0]), 10)
        const name = decodeURIComponent(params.yearAndName[1])
        if (!year || !name) notFound()

        return ombulOperations.read({
            params: {
                name,
                year
            }
        })
    },
    capabilities: () => ({
        canUpdateParagraph: ombulAuth.updateParagraphContent,
    }),
    metadata: (ombul) => ({ title: ombul.name }),
    render: ({ data: ombul, capabilities }) => {
        const path = `/store/ombul/${ombul.fsLocation}`

        return (
            <PageWrapper hideTitle className={styles.ombulPage}>
                <div className={styles.header}>
                    <div className={styles.titleBlock}>
                        <ChangeName ombulId={ombul.id}>
                            <h1>{ombul.name}</h1>
                        </ChangeName>
                        <p className={styles.issue}>{ombul.year} &middot; utgave {ombul.issueNumber}</p>
                        {ombul.description && <p className={styles.description}>{ombul.description}</p>}
                    </div>
                    {/* Beside the title rather than in the wrapper's header slot, which sits above it -
                        the actions would otherwise be read before the issue they act on. */}
                    <div className={styles.actions}>
                        <a className={styles.download} href={path} download>Last ned</a>
                        <Link className={styles.secondaryAction} href={path} target="blank">Åpne i ny fane</Link>
                        <PopUp
                            popUpKey={`OmbulPdfViewer${ombul.id}`}
                            showButtonClass={styles.secondaryAction}
                            showButtonContent="Les PDF"
                        >
                            <PdfDocument src={path} className={styles.book} />
                        </PopUp>
                    </div>
                </div>

                <div className={styles.coverAndParagraph}>
                    {/* The cover itself rather than an OmbulCover card: on this page that card linked
                        back to the page you are already on and repeated the name and issue printed
                        right above it. */}
                    <div className={styles.cover}>
                        <Image image={ombul.coverImage} width={260} />
                    </div>
                    <CmsParagraph
                        className={styles.paragraph}
                        capabilities={{ canEdit: capabilities.canUpdateParagraph }}
                        cmsParagraph={ombul.paragraph}
                        updateCmsParagraphAction={configureAction(
                            updateOmbulParagraphContentAction,
                            { implementationParams: { ombulId: ombul.id } }
                        )}
                    />
                </div>

                <OmbulAdmin ombul={ombul} />
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
