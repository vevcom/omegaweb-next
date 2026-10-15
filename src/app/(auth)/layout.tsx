import StandardImageServer from '@/components/Image/StandardImageServer'
import frontpageStyles from '@/app/(frontpage)/page.module.scss'
import React from 'react'

type PropTypes = {
    children: React.ReactNode
}

const heroImage = frontpageStyles.frontImg

export default function AuthLayout({ children }: PropTypes) {
    return (
        <div className={[
            'flex items-stretch justify-center',
            'min-h-[calc(100dvh-64px-3*var(--gap))] max-mobile:min-h-[calc(100dvh-128px-4*var(--gap))]',
        ].join(' ')}>
            <div className="flex items-stretch gap-2 w-full max-mobile:flex-col">
                {/* Wide enough that the form doesn't read as a narrow strip against the photo beside it. */}
                <div className={[
                    'flex-[0_0_min(460px,100%)] flex flex-col items-center justify-center gap-2 py-8 px-6',
                    'rounded-round bg-surface-base overflow-y-auto [&>*]:w-full max-mobile:flex-1',
                    // On a short viewport centring would push the top of the form under the navbar, out of
                    // scroll reach, so it anchors to the top instead and the crest above it is dropped.
                    '[@media(max-height:700px)]:justify-start',
                ].join(' ')}>
                    <div className="grid place-items-center py-4 invert [@media(max-height:700px)]:hidden">
                        <StandardImageServer
                            standardImage="MAGISK_HATT"
                            alt="en kappemann sin hatt"
                            width={120}
                        />
                    </div>
                    {children}
                </div>
                {/* The background photo is the frontpage hero's, whose url() lives in that module. */}
                <div className={`flex-1 min-w-0 rounded-round bg-cover bg-center max-mobile:hidden ${heroImage}`} />
            </div>
        </div>
    )
}
