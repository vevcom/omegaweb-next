import CreateHighlight from './CreateHighlight'
import EditHighlight from './EditHighlight'
import { careerAdminNavDef } from '@/app/(careers)/career/admin/careerAdminNavDef'
import { careerFrontpageHighlightOperations } from '@/services/careers/frontpage/highlights/operations'
import { isHighlightShowable } from '@/services/careers/frontpage/highlights/constants'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { displayDate } from '@/lib/dates/displayDate'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { ExpandedCareerFrontpageHighlight } from '@/services/careers/frontpage/highlights/types'

/** The front page only shows the highlight if the target still qualifies, so a disqualified one is hidden. */
function statusOf(highlight: ExpandedCareerFrontpageHighlight, now: Date) {
    if (highlight.end < now) return 'Utløpt'
    if (!isHighlightShowable(highlight, now)) return 'Skjult'
    return highlight.start > now ? 'Planlagt' : 'Aktiv'
}

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        careerAdminNavDef.authorize('highlights', session)
        const [highlights, targets] = await Promise.all([
            careerFrontpageHighlightOperations.readMany({}),
            careerFrontpageHighlightOperations.readTargets({}),
        ])
        return { highlights, targets }
    },
    metadata: () => ({ title: 'Fremhevinger' }),
    render: ({ data: { highlights, targets } }) => {
        const now = new Date()
        return (
            <PageWrapper headerItem={<CreateHighlight targets={targets} />}>
                {highlights.length ? (
                    <ul className="flex flex-col gap-2 m-0 p-0 list-none">
                        {highlights.map(highlight => {
                            const name = highlight.event?.name ?? highlight.jobAd?.articleName ?? ''
                            return (
                                <li key={highlight.id} className="
                                    flex flex-wrap items-center gap-x-6 gap-y-1 p-4 rounded-(--rounding) bg-base-200
                                ">
                                    <div className="flex-1 min-w-[14rem]">
                                        <p className="m-0 font-semibold">{name}</p>
                                        <p className="m-0 text-s text-base-content/80">
                                            {highlight.event ? 'Bedriftspresentasjon' : 'Jobbannonse'}
                                        </p>
                                    </div>
                                    <p className="m-0 text-s text-base-content/80">
                                        {displayDate(highlight.start)} – {displayDate(highlight.end)}
                                    </p>
                                    <p className="m-0 text-s font-semibold">{statusOf(highlight, now)}</p>
                                    <EditHighlight highlight={highlight} targets={targets} name={name} />
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <p className="text-base-content/80">Ingenting er fremhevet ennå.</p>
                )}
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
