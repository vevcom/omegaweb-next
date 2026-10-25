import ResetPasswordForm from './ResetPasswordForm'
import { verifyResetPasswordTokenAction } from '@/services/auth/actions'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { SearchParamsServerSide } from '@/lib/queryParams/types'

type PropTypes = SearchParamsServerSide

export default async function ResetPassword({ searchParams }: PropTypes) {
    const token = QueryParams.token.decode(await searchParams)

    if (!token) {
        return <>
            <h1>Ops</h1>
            <p>Lenken er ufullstendig. Be om en ny lenke for å nullstille passordet.</p>
        </>
    }
    const verify = await verifyResetPasswordTokenAction({ params: { token } })

    if (!verify.success) {
        const errorMessage = verify.error?.map(e => e.message).join('\n') ?? 'Lenken er ugyldig'

        return <>
            <h1>Ops</h1>
            <p>{errorMessage}</p>
        </>
    }

    return <ResetPasswordForm token={token} />
}
