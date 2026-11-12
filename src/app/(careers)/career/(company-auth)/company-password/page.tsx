import ChooseCompanyUserPassword from './ChooseCompanyUserPassword'
import { companyUserAccountOperations } from '@/services/careers/companies/users/account/operations'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage, withFallback } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

/** Where the link in a company user's mail leads: the form they choose their password in. */
const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const token = QueryParams.token.decode(searchParams)
        if (!token) return { token: null, valid: false, email: null }
        const verified = await withFallback(
            companyUserAccountOperations.verifyPasswordToken({ params: { token } }),
            null,
        )
        return { token, valid: verified !== null, email: verified?.email ?? null }
    },
    metadata: () => ({ title: 'Velg passord' }),
    render: ({ data }) => {
        if (!data.token || !data.valid) {
            return <>
                <h1>Ops</h1>
                <p>
                    Lenken er ugyldig, utløpt eller allerede brukt. Be en administrator for bedriften om å sende
                    deg en ny.
                </p>
            </>
        }
        return <ChooseCompanyUserPassword token={data.token} email={data.email} />
    },
})

export default page
export { generateMetadata }
