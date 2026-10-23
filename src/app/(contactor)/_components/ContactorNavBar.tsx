import ContactorWordmark from './ContactorWordmark'
import { CAREER_PATH } from '@/app/(contactor)/_lib/contactorSite'
import { innerClassName } from '@/app/(contactor)/_lib/contactorClassNames'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    links: { name: string, href: string }[],
}

const linkClassName = `
    inline-flex items-center gap-2 py-2 border-b-2 border-transparent text-m font-medium transition-[border-color,color]
    duration-300
    hover:no-underline hover:border-contactor-accent
`

/**
 * Contactor's navigation: the wordmark, the links, and the way back to Omega's site. The edit
 * mode switch is there for those who may edit the CMS content of the pages - it renders nothing
 * for everyone else.
 */
export default function ContactorNavBar({ links }: PropTypes) {
    return (
        <header className="sticky top-0 z-3 bg-surface-raised border-b border-contactor-line">
            <nav className={`
                ${innerClassName}
                min-h-[64px] flex flex-wrap items-center gap-6
                max-mobile:pb-2
            `}>
                <Link href={CAREER_PATH} className="mr-auto no-underline" aria-label="Contactor, til forsiden">
                    <ContactorWordmark />
                </Link>
                <ul className={`
                    list-none flex items-center gap-6
                    max-mobile:order-3 max-mobile:w-full max-mobile:flex-wrap max-mobile:gap-y-0
                `}>
                    {links.map(link => (
                        <li key={link.href}>
                            <Link href={link.href} className={`
                                ${linkClassName}
                                text-contactor-navy
                            `}>{link.name}</Link>
                        </li>
                    ))}
                    <li className="
                        ml-4 pl-6 border-l border-contactor-line
                        max-mobile:ml-0 max-mobile:pl-0 max-mobile:border-l-0
                    ">
                        <Link href="/" className={`
                            ${linkClassName}
                            text-text-muted
                            hover:text-contactor-navy
                            [&_svg]:size-[0.8em] [&_svg]:text-inherit
                        `}>
                            <FontAwesomeIcon icon={faArrowLeft} />
                            <span>Tilbake til Omegaveven</span>
                        </Link>
                    </li>
                </ul>
                <div className="
                    size-[40px]
                    empty:hidden
                ">
                    <EditModeSwitch />
                </div>
            </nav>
        </header>
    )
}
