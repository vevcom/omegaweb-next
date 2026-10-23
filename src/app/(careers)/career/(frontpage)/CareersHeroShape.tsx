type PropTypes = {
    /** Wide screens get the sweep down the right of the hero; phones a curve across its top. */
    variant: 'desktop' | 'mobile',
}

const svgClassName = 'block size-full'

/**
 * The decoration of contactor.no's hero: a navy field with a cyan edge, curving across the page.
 * Both paths are theirs; the shapes are stretched to the box they sit in.
 */
export default function CareersHeroShape({ variant }: PropTypes) {
    if (variant === 'mobile') {
        return (
            <div aria-hidden="true" className={`
                hidden h-[7rem] mx-[calc(-1*var(--careers-page-padding))] mb-4 pointer-events-none
                max-mobile:block
            `}>
                <svg className={svgClassName} viewBox="0 0 400 300" preserveAspectRatio="none" focusable="false">
                    <path
                        className="fill-careers-accent"
                        d="M 0 0 L 0 146 C 18 160, 50 174, 110 180 S 240 190, 300 214 S 375 264, 400 300 L 400 0 Z"
                    />
                    <path
                        className="fill-careers-navy"
                        d="M 0 0 L 0 128 C 18 142, 50 156, 110 162 S 240 172, 300 196 S 375 246, 400 282 L 400 0 Z"
                    />
                </svg>
            </div>
        )
    }
    return (
        <div aria-hidden="true" className="
            absolute inset-0 pointer-events-none
            max-mobile:hidden
        ">
            <div className="absolute inset-y-0 right-0 left-[calc(50%+var(--careers-max-width)/2-1rem)] bg-careers-navy" />
            <div className="absolute inset-y-0 left-1/2 w-[min(100%,var(--careers-max-width))] -translate-x-1/2">
                <svg className={svgClassName} viewBox="0 0 1000 700" preserveAspectRatio="none" focusable="false">
                    <path
                        className="fill-careers-accent"
                        d="M 320 0 C 345 115, 525 180, 625 312 S 790 650, 895 700 L 980 700 L 980 0 Z"
                    />
                    <path
                        className="fill-careers-navy"
                        d="M 345 0 C 370 110, 560 170, 660 300 S 830 640, 965 700 L 1000 700 L 1000 0 Z"
                    />
                </svg>
            </div>
        </div>
    )
}
