import { revueLinks } from '@/app/(revue)/links'
import SiteLink from '@/components/SiteLink/SiteLink'

export default function RevueNotFound() {
    return (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
            <h1 className="text-xxl">404</h1>
            <p>Fant ikke siden du lette etter.</p>
            <SiteLink href={revueLinks.frontpage()}>Til forsiden</SiteLink>
        </div>
    )
}
