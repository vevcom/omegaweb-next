import CmsPersonEditor from './CmsPersonEditor'
import Image from '@/components/Image/Image'
import StandardImageClient from '@/components/Image/StandardImageClient'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import type {
    DestroyCmsPersonAction,
    ExpandedCmsPerson,
    MoveCmsPersonAction,
    UpdateCmsPersonAction,
    UpdateCmsPersonImageAction,
} from '@/cms/persons/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

export type PropTypes = {
    cmsPerson: ExpandedCmsPerson
    className?: string
    canMoveBack: boolean
    canMoveForward: boolean
    updateCmsPersonAction: UpdateCmsPersonAction
    updateCmsPersonImageAction: UpdateCmsPersonImageAction
    moveCmsPersonAction: MoveCmsPersonAction
    destroyCmsPersonAction: DestroyCmsPersonAction
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
    updateCmsPersonImageAction,
    moveCmsPersonAction,
    destroyCmsPersonAction,
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
                [&_img]:size-full
            ">
                {cmsPerson.image ? (
                    <Image
                        image={cmsPerson.image}
                        width={400}
                        alt={cmsPerson.name}
                        hideCredit
                        className="[&>img]:object-cover"
                    />
                ) : (
                    <StandardImageClient
                        standardImage="DEFAULT_PROFILE_IMAGE"
                        width={400}
                        alt=""
                        hideCredit
                        className="[&_img]:object-contain [&_img]:p-[20%]"
                    />
                )}
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
                updateCmsPersonImageAction={updateCmsPersonImageAction}
                moveCmsPersonAction={moveCmsPersonAction}
                destroyCmsPersonAction={destroyCmsPersonAction}
                capabilities={capabilitiesToJsObject(capabilities)}
            />
        </article>
    )
}
