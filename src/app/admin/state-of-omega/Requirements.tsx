import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { OmegaOrderRequirement } from '@/services/omegaOrder/types'

type PropTypes = {
    requirements: OmegaOrderRequirement[]
}

/**
 * The conditions that must hold before omega can be incremented, each with a check or a cross
 * depending on whether it is met.
 */
export default function Requirements({ requirements }: PropTypes) {
    const fulfilledCount = requirements.filter(requirement => requirement.fulfilled).length
    const allFulfilled = fulfilledCount === requirements.length

    return (
        <div className="flex flex-col gap-2">
            <div
                className={[
                    'flex justify-between items-center gap-2 [&_p]:m-0 [&_p]:text-text-muted [&>span]:font-bold',
                    '[&>span]:whitespace-nowrap',
                ].join(' ')}
            >
                <p>For å kunne opprette neste orden må følgende ha skjedd:</p>
                <span className={allFulfilled ? 'text-accent-green' : 'text-accent-red'}>
                    {fulfilledCount} / {requirements.length}
                </span>
            </div>
            <ul className="list-none m-0 p-0 flex flex-col gap-1">
                {requirements.map(requirement => (
                    <li
                        key={requirement.key}
                        className={[
                            'flex items-center gap-4 py-2 px-4 rounded-round layer [&_span]:text-text',
                            '[&_svg]:shrink-0 [&_svg]:w-[1.2em]! [&_svg]:h-[1.2em]!',
                            requirement.fulfilled ? 'text-accent-green' : 'text-accent-red',
                        ].join(' ')}
                    >
                        <FontAwesomeIcon icon={requirement.fulfilled ? faCheck : faXmark} />
                        <span>{requirement.description}</span>
                        {requirement.detail && <i
                            className={[
                                'ml-auto text-text-muted',
                                'text-s whitespace-nowrap',
                            ].join(' ')}
                        >{requirement.detail}</i>}
                    </li>
                ))}
            </ul>
        </div>
    )
}
