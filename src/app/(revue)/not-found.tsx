import { revueLinks } from '@/app/(revue)/_lib/revueSite'
import Link from 'next/link'

export default function RevueNotFound() {
    return (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
            <h1 className="text-xxl">404</h1>
            <p>Fant ikke siden du lette etter.</p>
            <Link href={revueLinks.frontpage()}>Til forsiden</Link>
        </div>
    )
}
