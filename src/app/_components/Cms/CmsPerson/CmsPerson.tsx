import CmsPersonEditor from './CmsPersonEditor'
import CmsImage from '@/components/Cms/CmsImage/CmsImage'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import type {
    DestroyCmsPersonAction,
    ExpandedCmsPerson,
    MoveCmsPersonAction,
    UpdateCmsPersonAction,
} from '@/cms/persons/types'
import type { UpdateCmsImageAction } from '@/cms/images/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

export type PropTypes = {
    cmsPerson: ExpandedCmsPerson
    className?: string
    canMoveBack: boolean
    canMoveForward: boolean
    updateCmsPersonAction: UpdateCmsPersonAction
    moveCmsPersonAction: MoveCmsPersonAction
    destroyCmsPersonAction: DestroyCmsPersonAction
    updateCmsImageAction: UpdateCmsImageAction
    capabilities: Capabilities<'canEdit'>
}

/**
 * A person with a portrait, a name, a title and an optional email address. The owning service
 * passes its implementations of the person's actions.
 */
export default function CmsPerson({
    cmsPerson,
    className = '',
    canMoveBack,
    canMoveForward,
    updateCmsPersonAction,
    moveCmsPersonAction,
    destroyCmsPersonAction,
    updateCmsImageAction,
    capabilities,
}: PropTypes) {
    return (
        <article className={`
            flex flex-col
            ${className}
        `}>
            <div className="
                [--image-width:100%] aspect-4/5 overflow-hidden bg-surface-hover
                [&>div]:block [&>div]:size-full
                [&_img]:size-full [&_img]:object-cover
            ">
                <CmsImage
                    cmsImage={cmsPerson.cmsImage}
                    width={400}
                    alt={cmsPerson.name}
                    hideCredit
                    updateCmsImageAction={updateCmsImageAction}
                    capabilities={capabilities}
                />
            </div>
            <p className="mt-4 text-m font-semibold leading-snug">{cmsPerson.name}</p>
            <p className="mt-0.5 text-s text-text-muted">{cmsPerson.title}</p>
            {cmsPerson.email && (
                <a
                    href={`mailto:${cmsPerson.email}`}
                    className="
                        mt-1.5 text-s text-text-muted break-all transition-colors
                        hover:text-accent-blue
                    "
                >
                    {cmsPerson.email}
                </a>
            )}
            <CmsPersonEditor
                cmsPerson={cmsPerson}
                canMoveBack={canMoveBack}
                canMoveForward={canMoveForward}
                updateCmsPersonAction={updateCmsPersonAction}
                moveCmsPersonAction={moveCmsPersonAction}
                destroyCmsPersonAction={destroyCmsPersonAction}
                capabilities={capabilitiesToJsObject(capabilities)}
            />
        </article>
    )
}
