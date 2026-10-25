import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import { serverPage } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ session }: PageOperationArgs) => authorizeAdminPage(null, session),
    render: () => (
        <div className="w-full h-full flex flex-col items-center">
            <FontAwesomeIcon
                icon={faScrewdriverWrench}
                className="pt-[calc(50vh-50px-5em)] w-[10em]! h-[10em]! text-text m-[1em]"
            />
            <p className="text-text-muted text-[1.5em] text-center">Velg hva du vil administrere i menyen</p>
        </div>
    ),
})

export default page
export { generateMetadata }
