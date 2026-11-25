import StandardImageServer from '@/components/Image/StandardImageServer'

export default function RevueWordmark() {
    return (
        <span className="
            inline-flex items-center gap-3 whitespace-nowrap
            max-[359px]:gap-2
        ">
            <StandardImageServer
                standardImage="REVUE_LOGO"
                width={46}
                aria-hidden
                imageContainerClassName="
                    w-[46px] aspect-[1764/1519]
                    max-[359px]:w-[38px]
                "
            />
            <span className="
                font-secondary text-[1.6rem] font-bold leading-none tracking-[-0.01em] text-base-content
                max-[359px]:text-[1.35rem]
            ">
                Omegarevyen
            </span>
        </span>
    )
}
