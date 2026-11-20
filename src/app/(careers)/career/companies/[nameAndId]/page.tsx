import { getCompany } from './getCompany'
import CompanyEvents from './CompanyEvents'
import CompanyJobAds from './CompanyJobAds'
import { readCompanyEvents } from './readCompanyEvents'
import Image from '@/components/Image/Image'
import SiteLink from '@/components/SiteLink/SiteLink'
import { hrefOf } from '@/lib/sites/href'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import { serverPage, withFallback } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const LOGO_WIDTH = 320

/** A company's own page: what it says about itself, its job ads and its events. */
const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ nameAndId: string }>) => {
        const company = await getCompany(params.nameAndId)
        const jobAds = await withFallback(
            jobAdOperations.readOfCompany({ params: { companyId: company.id } }),
            [],
            ['UNAUTHENTICATED', 'UNAUTHORIZED']
        )
        return { company, jobAds, eventsOfKinds: await readCompanyEvents(company.id) }
    },
    metadata: ({ company }) => ({
        title: company.name,
        description: company.description || undefined,
    }),
    render: ({ data: { company, jobAds, eventsOfKinds } }) => <>
        <section className="
            flex flex-row items-start gap-8 p-8 bg-base-200 border border-careers-line
            max-mobile:flex-col max-mobile:p-6
        ">
            {company.logoImage && (
                <div className="
                    shrink-0 w-48
                    max-mobile:w-40
                    [&>div]:w-full
                    [&_img]:h-auto [&_img]:object-contain
                    tone-light:[&_img]:invert tone-light:[&_img]:hue-rotate-180
                ">
                    <Image
                        image={company.logoImage}
                        alt={company.name}
                        width={LOGO_WIDTH}
                        hideCredit
                        hideCopyRight
                        disableLinkingToLicense
                    />
                </div>
            )}
            <div className="flex flex-col gap-4 text-m">
                {company.description && <p>{company.description}</p>}
                {company.website && (
                    <SiteLink href={hrefOf(company.website)} target="_blank" rel="noreferrer">
                        {company.website}
                    </SiteLink>
                )}
                {!company.description && !company.website && (
                    <p className="text-base-content/80">Bedriften har ikke lagt inn noe om seg selv ennå.</p>
                )}
            </div>
        </section>
        <CompanyJobAds jobAds={jobAds} />
        <CompanyEvents eventsOfKinds={eventsOfKinds} />
    </>,
})

export default page
export { generateMetadata }
