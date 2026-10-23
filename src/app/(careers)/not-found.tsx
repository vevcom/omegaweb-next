import Link from 'next/link'

export default function CareersNotFound() {
    return (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
            <h1 className="text-xxl text-careers-navy">404</h1>
            <p>Fant ikke siden du lette etter.</p>
            <Link href="/career" className="text-careers-accent-dark font-semibold">Til forsiden</Link>
        </div>
    )
}
