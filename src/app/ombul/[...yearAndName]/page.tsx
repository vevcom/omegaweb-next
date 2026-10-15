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
import { serverPage } from '@/app/ServerPage'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

// A sheet of paper, capped at the column width so the collapsed layout doesn't make it taller than the viewport.
// The Image component sizes its wrapper divs off the image's intrinsic width, so they are forced to fill the box.
const coverClassName = [
    'relative w-full max-w-[calc(33*var(--gap))] aspect-[5/7] rounded-round overflow-hidden bg-surface-raised',
    '[&_div]:absolute [&_div]:inset-0 [&_div]:w-full [&_div]:h-full [&_img]:w-full [&_img]:h-full [&_img]:object-cover',
].join(' ')

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ yearAndName: string[] }>) => {
        if (params.yearAndName.length !== 2) notFound()

        return ombulOperations.read({
            params: {
                id: decodeVevenUriHandleError(params.yearAndName[1]),
            },
        })
    },
    capabilities: () => ({
        canUpdateParagraph: ombulAuth.updateParagraphContent,
    }),
    metadata: (ombul) => ({ title: ombul.name }),
    render: ({ data: ombul, capabilities }) => {
        const path = `/store/ombul/${ombul.fsLocation}`

        return (
            <PageWrapper hideTitle className="[&_h1]:normal-case!">
                <div className="mb-6 flex flex-row flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <ChangeName ombulId={ombul.id}>
                            <h1>{ombul.name}</h1>
                        </ChangeName>
                        <p className="mt-1 text-text-muted text-m">{ombul.year} &middot; utgave {ombul.issueNumber}</p>
                        {ombul.description && <p className="mt-2 max-w-[75ch]">{ombul.description}</p>}
                    </div>
                    {/* Beside the title rather than in the wrapper's header slot, which sits above it -
                        the actions would otherwise be read before the issue they act on. */}
                    <div className="flex flex-row flex-wrap items-center gap-2">
                        <a className="btn m-0!" href={path} download>Last ned</a>
                        <Link className="secondary-btn m-0!" href={path} target="blank">Åpne i ny fane</Link>
                        <PopUp
                            popUpKey={`OmbulPdfViewer${ombul.id}`}
                            showButtonClass="secondary-btn m-0!"
                            showButtonContent="Les PDF"
                        >
                            <PdfDocument src={path} className="block w-[min(calc(100vw-4rem),calc(130svh-6rem))]" />
                        </PopUp>
                    </div>
                </div>

                <div className="grid grid-cols-[calc(33*var(--gap))_1fr] items-start gap-6 max-mobile:grid-cols-1">
                    {/* The cover itself rather than an OmbulCover card: on this page that card linked
                        back to the page you are already on and repeated the name and issue printed
                        right above it. */}
                    <div className={coverClassName}>
                        <Image image={ombul.coverImage} width={260} />
                    </div>
                    <CmsParagraph
                        className="max-w-[75ch]"
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
