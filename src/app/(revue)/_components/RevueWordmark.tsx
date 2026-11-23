import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMasksTheater } from '@fortawesome/free-solid-svg-icons'

export default function RevueWordmark() {
    return (
        <span className="
            inline-flex items-center gap-3 whitespace-nowrap
            max-[359px]:gap-2
        ">
            <FontAwesomeIcon icon={faMasksTheater} className="size-[1.4rem]! text-accent" />
            <span className="
                font-secondary text-[1.6rem] font-bold leading-none tracking-[-0.01em] text-base-content
                max-[359px]:text-[1.35rem]
            ">
                Omegarevyen
            </span>
        </span>
    )
}
