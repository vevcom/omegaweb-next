import TeamPersonEditor from './TeamPersonEditor'
import Image from '@/components/Image/Image'
import StandardImageClient from '@/components/Image/StandardImageClient'
import type { ExpandedCareerTeamPerson } from '@/services/careers/team/persons/types'

type PropTypes = {
    person: ExpandedCareerTeamPerson
    canMoveBack: boolean
    canMoveForward: boolean
}

export default function TeamPerson({ person, canMoveBack, canMoveForward }: PropTypes) {
    return (
        <article className="flex flex-col">
            <div className="
                [--image-width:100%] aspect-4/5 overflow-hidden bg-surface-hover
                [&>div]:block [&>div]:size-full
                [&_img]:size-full
            ">
                {person.image ? (
                    <Image
                        image={person.image}
                        width={400}
                        alt={person.name}
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
            <p className="mt-4 text-m font-semibold leading-snug">{person.name}</p>
            <p className="mt-0.5 text-s text-base-content/80">{person.title}</p>
            {person.email && (
                <a
                    href={`mailto:${person.email}`}
                    className="
                        mt-1.5 text-s text-base-content/80 break-all transition-colors
                        hover:text-accent-blue
                    "
                >
                    {person.email}
                </a>
            )}
            <TeamPersonEditor person={person} canMoveBack={canMoveBack} canMoveForward={canMoveForward} />
        </article>
    )
}
