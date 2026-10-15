'use client'
import EditCategory from './EditCategory'
import useScroll from '@/hooks/useScroll'
import useOnNavigation from '@/hooks/useOnNavigation'
import useViewPort from '@/hooks/useViewPort'
import useAuthorizer from '@/hooks/useAuthorizer'
import { removeArticleFromCategoryAction } from '@/services/articleCategories/actions'
import { articleCategoryAuth } from '@/services/articleCategories/auth'
import { formatVevenUri } from '@/lib/urlEncoding'
import React, { useRef, useState } from 'react'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronUp, faX } from '@fortawesome/free-solid-svg-icons'
import { useRouter } from 'next/navigation'
import type { ExpandedArticleCategoryWithVisibility } from '@/services/articleCategories/types'

// Desktop-only styles carry mobile:, mobile-only ones max-mobile:. The content and the mobile bar are
// each display: none on the other breakpoint, so their inner styles need no prefix.
const mainClassName = [
    'mobile:bg-surface-base mobile:rounded-round mobile:z-1 mobile:overflow-hidden mobile:w-[calc(100%-300px-var(--gap))]',
    'max-mobile:min-h-screen max-mobile:w-full',
].join(' ')

const sideBarContentClassName = [
    'max-mobile:hidden opacity-0 h-full [transition:opacity_300ms,transform_0.05s_ease-out] overflow-auto text-text',
    'm-[1em_0em_1em_1em] p-[calc(3*var(--rounding))] [&_h2]:text-l',
].join(' ')

const sideBarMobileClassName = [
    'hidden max-mobile:block fixed bottom-0 left-0 w-screen z-8 layer',
    'transition-[padding-bottom,height] duration-300 [&_ul>li]:ml-[calc(50px+var(--gap))]',
].join(' ')

const sideBarMobileOpenClassName = 'pb-[60px] [&_svg]:[transform:rotateX(180deg)]'

const mainListContentClassName = [
    'list-none p-0 [&_li]:my-[1em] [&_li]:flex [&_li]:justify-between',
    '[&_li_a]:text-text [&_li_a]:no-underline [&_li_a:hover]:underline',
].join(' ')

const destroyArticleClassName = [
    'w-[20px] h-[20px] bg-accent-red border-none rounded-full cursor-pointer transition-[background] duration-500',
    'flex justify-center items-center hover:bg-[color-mix(in_srgb,var(--accent-red),black_10%)]',
].join(' ')

type PropTypes = {
    category: ExpandedArticleCategoryWithVisibility
    children: React.ReactNode
}

export default function SideBar({ category, children }: PropTypes) {
    const ref = useRef<HTMLDivElement>(null)
    const measure = useRef<HTMLDivElement>(null)
    const [openMobile, setOpenMobile] = useState(false)

    //Makes sure the sidebar does not go under the footer
    const handleHeight = (x: number, y: number) => {
        const mainRect = document.querySelector('main')?.getBoundingClientRect()
        const sidebarRect = measure.current?.getBoundingClientRect()
        const docHeight = document.documentElement.scrollHeight
        const overscroll = Math.max(0, window.innerHeight + y - docHeight)
        if (!mainRect || !sidebarRect || !ref.current) return
        ref.current.style.opacity = '1'
        if (mainRect.bottom < sidebarRect.bottom) {
            ref.current.style.maxHeight = `${mainRect.bottom - sidebarRect.top - 10 + overscroll}px`
        } else {
            ref.current.style.maxHeight = '100%'
        }
    }

    useScroll(handleHeight)
    useOnNavigation(() => handleHeight(window.screenX, window.scrollY))
    useOnNavigation(() => setOpenMobile(false))
    useViewPort(() => handleHeight(window.screenX, window.scrollY))

    return (
        <div className="flex relative mobile:h-full mobile:gap-2">
            <aside className="mobile:bg-surface-base mobile:rounded-round mobile:w-[300px] mobile:left-0 mobile:z-2">
                <div ref={measure} className="mobile:h-[calc(100%-2em)]">
                    <div ref={ref} className={sideBarContentClassName}>
                        <h2>{category.name.toUpperCase()}</h2>
                        <MainListContent category={category} />
                    </div>
                </div>
            </aside>

            <main className={mainClassName}>
                {children}
            </main>

            <span className={`${sideBarMobileClassName} ${openMobile ? sideBarMobileOpenClassName : 'h-[110px]'}`}>
                <button
                    className="flex items-center w-full h-[40px] bg-transparent border-none my-2 mx-0"
                    onClick={() => setOpenMobile(x => !x)}
                >
                    <FontAwesomeIcon
                        icon={faChevronUp}
                        className="size-[40px]! m-[5px] text-text transition-transform duration-[0.35s]"
                    />
                    <h1 className="my-0 mx-2 text-text">{category.name.toUpperCase()}</h1>
                </button>
                <MainListContent category={category} />
            </span>
        </div>

    )
}

function MainListContent({ category }: { category: ExpandedArticleCategoryWithVisibility }) {
    const canRemoveArticle = useAuthorizer({
        authorizer: articleCategoryAuth.removeArticleFromCategory.data({ visibility: category.visibility })
    }).authorized
    const { push, refresh } = useRouter()

    const handleDestroy = async (id: number) => {
        const res = await removeArticleFromCategoryAction(
            { implementationParams: { articleCategoryId: category.id } },
            { params: { articleId: id } }
        )
        if (!res.success) throw new Error('Kunne ikke slette artikkelen')
        push(`/articles/${category.name}`)
        refresh()
    }

    return (
        <ul className={mainListContentClassName}>
            {
                category.articles.map(article => (
                    <li key={article.id}>
                        <Link href={`/articles/${category.name}/${formatVevenUri(article.name, article.id)}`}>
                            {article.name.toUpperCase()}
                        </Link>
                        {
                            canRemoveArticle && (
                                <button
                                    className={destroyArticleClassName}
                                    onClick={() => handleDestroy(article.id)}
                                >
                                    <FontAwesomeIcon icon={faX} />
                                </button>
                            )
                        }
                    </li>
                ))
            }
            <EditCategory category={category} />
        </ul>
    )
}
