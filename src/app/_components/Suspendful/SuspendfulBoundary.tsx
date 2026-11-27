'use client'
import SuspendfulError from './SuspendfulError'
import Button from '@/components/UI/Button'
import useSiteRouter from '@/hooks/useSiteRouter'
import { catchError } from 'next/error'
import { useTransition } from 'react'
import type { ErrorInfo } from 'next/error'
import type { ReactNode } from 'react'

/**
 * The boundary of a Suspendful, for a bug thrown while its section renders. It is built with
 * Next's catchError, which lets redirect and notFound through, as a boundary written by hand does
 * not. In production the error it is handed says nothing of what went wrong, so neither does this.
 */
export const SuspendfulBoundary = catchError(
    ({ shape }: { shape: ReactNode }, { retry }: ErrorInfo) => (
        <SuspendfulError shape={shape} message="Noe gikk galt her" action={<TryAgain tryAgain={retry} />} />
    )
)

/** Loads the page's server components again, which is what brings back a section the server rendered as an error. */
export function SuspendfulRefresh() {
    const router = useSiteRouter()
    return <TryAgain tryAgain={() => router.refresh()} />
}

// Trying again loads every section of the page and shows no fallback meanwhile, so the button says it is working.
function TryAgain({ tryAgain }: { tryAgain: () => void }) {
    const [pending, startTransition] = useTransition()
    return (
        <Button type="button" disabled={pending} onClick={() => startTransition(tryAgain)}>
            {pending ? 'Prøver igjen...' : 'Prøv igjen'}
        </Button>
    )
}
