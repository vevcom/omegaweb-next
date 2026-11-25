import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { htmlContentClassName } from '@/components/Cms/CmsParagraph/htmlContentClassName'
import { versionsOperations } from '@/services/versions/operations'
import { serverPage } from '@/app/ServerPage'
import { displayDate } from '@/lib/dates/displayDate'

const { page, generateMetadata } = serverPage({
    operation: () => versionsOperations.readAll({}),
    metadata: () => ({ title: 'Versjoner' }),
    render: ({ data: versions }) => (
        <PageWrapper>
            {versions.length === 0 && <p>Det er ingen versjoner å vise.</p>}
            {versions.map(version => (
                <section key={version.version} id={version.version} className="mb-10">
                    <h2 className="text-xl mb-1">
                        {version.version}
                        {version.name !== version.version && <span className="font-normal"> {version.name}</span>}
                        {version.current && <span className="text-primary"> (i bruk nå)</span>}
                    </h2>
                    <p className="text-s text-base-content/70 mb-3">Utgitt {displayDate(version.releasedAt, false)}</p>
                    <div
                        // Important, since PageWrapper styles every h1 in the page at the same specificity.
                        className={`
                            ${htmlContentClassName}
                            [&_h1]:text-l! [&_h1]:normal-case!
                            [&_h2]:text-l
                        `}
                        dangerouslySetInnerHTML={{ __html: version.notesHtml }}
                    />
                </section>
            ))}
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
