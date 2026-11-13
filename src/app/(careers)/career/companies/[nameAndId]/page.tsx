import { getCompany } from './getCompany'
import Image from '@/components/Image/Image'
import SiteLink from '@/components/SiteLink/SiteLink'
import { hrefOf } from '@/lib/sites/href'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const LOGO_WIDTH = 320

/** What the public is told about a company. */
const { page, generateMetadata } = serverPage({
    operation: ({ params }: PageOperationArgs<{ nameAndId: string }>) => getCompany(params.nameAndId),
    metadata: company => ({
        title: company.name,
        description: company.description || undefined,
    }),
    render: ({ data: company }) => (
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
    ),
})

export default page
export { generateMetadata }
