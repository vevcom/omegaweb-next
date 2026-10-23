import Link from 'next/link'

export default function ContactorNotFound() {
    return (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
            <h1 className="text-xxl text-contactor-navy">404</h1>
            <p>Fant ikke siden du lette etter.</p>
            <Link href="/career" className="text-contactor-accent-dark font-semibold">Til forsiden</Link>
        </div>
    )
}
