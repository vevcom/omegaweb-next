import RegisterAdmissiontrial from './registration'
import { admissionDisplayNames, allAdmissions } from '@/services/admission/constants'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { omegaIdOperations } from '@/services/omegaid/operations'
import { serverPage } from '@/app/serverPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/serverPage'
import type { Admission as AdmissionType } from '@/prisma-generated-pn-types'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ admission: AdmissionType }>) => {
        if (!allAdmissions.includes(params.admission)) {
            notFound()
        }

        const publicKey = await omegaIdOperations.readPublicKey({})
        return { admission: params.admission, publicKey }
    },
    metadata: (data) => ({ title: `Registrer opptak for ${admissionDisplayNames[data.admission]}` }),
    render: ({ data }) => (
        <PageWrapper>
            <UserPagingProvider
                startPage={{ page: 0, pageSize: 50 }}
                serverRenderedData={[]}
                details={{ partOfName: '', groups: [] }}
            >
                <RegisterAdmissiontrial
                    admission={data.admission}
                    omegaIdPublicKey={data.publicKey}
                />
            </UserPagingProvider>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
