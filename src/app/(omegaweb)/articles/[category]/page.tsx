import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page } = serverPage({
    operation: ({ params }: PageOperationArgs<{ category: string }>) => ({
        category: decodeURIComponent(params.category),
    }),
    render: ({ data }) => (
        <div className="
            w-full h-full flex items-center justify-center
            [&>p]:border-l [&>p]:border-base-300 [&>p]:ml-2 [&>p]:pl-2
        ">
            <h2>{data.category.toUpperCase()}</h2>
            <p>Velg en artikkel i navigasjonsmenyen</p>
        </div>
    ),
})

export default page
