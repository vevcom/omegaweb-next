import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencil } from '@fortawesome/free-solid-svg-icons'

/**
 *
 * This component is used to show an edit
 * icon on top of cms elements to activate editing when in editmode
 */
export default function EditOverlay() {
    return (
        <div
            className={[
                'group border-none z-2 absolute w-full h-full top-0 left-0 bg-surface-raised opacity-90 min-h-[30px]',
                'transition-colors duration-300 ease-in-out hover:bg-surface-subtle',
            ].join(' ')}
        >
            <div
                className={[
                    'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                    '[&_svg]:w-[min(30px,80%)] [&_svg]:h-[min(30px,80%)] [&_svg]:text-white',
                    '[&_svg]:transition-[scale] [&_svg]:duration-300 [&_svg]:ease-in-out',
                    'group-hover:[&>svg]:scale-120 group-hover:[&>svg]:text-accent-blue',
                ].join(' ')}
            >
                <FontAwesomeIcon icon={faPencil} />
            </div>
        </div>
    )
}
