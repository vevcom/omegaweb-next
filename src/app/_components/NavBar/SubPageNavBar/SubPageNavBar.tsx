'use client'
import SiteLink from '@/components/SiteLink/SiteLink'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { usePathname } from 'next/navigation'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import type { ReactNode } from 'react'

type SubPageNavBarProps = {
    children?: ReactNode,
    icon?: IconProp,
    href: string
}

export function SubPageNavBarItem({ children, icon, href }:SubPageNavBarProps) {
    const pathname = usePathname()
    const page = pathname.split('/').pop()
    const thisPage = href?.split('/').pop()

    return (
        <div className="
            m-0 grow-0
            last:mb-0
            [&>a]:no-underline
        ">
            <SiteLink href={href}>
                <div className={`
                    inline-flex items-center justify-center h-[calc(64px-2*var(--gap))] px-2 border-0
                    max-mobile:px-1
                    bg-transparent text-text
                    [&_*]:transition-colors [&_*]:duration-200 [&_*]:ease-[ease]
                    hover:[&_*]:text-accent-blue
                    ${page === thisPage ? '[&_*]:text-accent-blue' : ''}
                `}>
                    {icon && <FontAwesomeIcon icon={icon} className="w-[24px]! h-[24px]!" />}
                    <p className="
                        leading-[calc(64px-32px)] text-center pl-[16px]
                        max-mobile:hidden
                    ">{children}</p>
                </div>
            </SiteLink>
        </div>
    )
}

export function SubPageNavBar({ children }: {children: ReactNode}) {
    return (<>
        <div className="
            grid grid-flow-col auto-cols-max col-span-full justify-center gap-1 w-full mx-auto p-2 h-[64px] sticky
            bottom-0 z-2 rounded-round bg-surface-base overflow-x-auto
        ">
            {children}
        </div>
    </>)
}
