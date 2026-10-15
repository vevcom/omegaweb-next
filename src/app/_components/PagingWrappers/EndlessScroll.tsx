'use client'
import Button from '@/components/UI/Button'
import React, {
    useContext,
    useEffect,
    useMemo,
    useCallback,
    useState,
    useRef,
    useEffectEvent
} from 'react'
import { useInView } from 'react-intersection-observer'
import type { PagingContext } from '@/contexts/paging/PagingGenerator'

type PropTypes<Data, Cursor, PageSize extends number, FetcherDetails> = {
    pagingContext: PagingContext<Data, Cursor, PageSize, FetcherDetails>,
    renderer: (data: Data, i: number) => React.ReactNode,
    wrapper?: (children: React.ReactNode) => React.ReactNode,
    loadingInfoClassName?: string,
    /**
     * Wraps the loading indicator that trails the rendered items. Callers that render rows
     * into a <tbody> must pass a wrapper producing a valid row, because the plain <span>
     * this defaults to is not allowed there: the HTML parser moves it out of the table while
     * parsing the server-rendered markup, and React then bails out of hydrating the whole table.
     */
    loadingInfoWrapper?: (loadingInfo: React.ReactNode) => React.ReactNode,
}

export default function EndlessScroll<Data, Cursor, const PageSize extends number, FetcherDetails>({
    pagingContext,
    loadingInfoClassName,
    renderer,
    wrapper = children => <>{children}</>,
    loadingInfoWrapper
}: PropTypes<Data, Cursor, PageSize, FetcherDetails>) {
    const context = useContext(pagingContext)

    //This component must be rendered inside ContextProvider
    if (!context) throw new Error('Ingen kontekst')

    const { loading, state, loadMore } = context

    const [ref, inView] = useInView({
        threshold: 0,
    })

    const loadMoreCallback = useCallback(async () => {
        if (!inView) return
        await loadMore()
    }, [loadMore, inView])

    useEffect(() => {
        void loadMoreCallback()
    }, [inView, loadMoreCallback])


    const renderedPageData = useMemo(() => context.state.data.map((dataEntry, i) => {
        if (i < context.startPage.pageSize * context.startPage.page) return null
        return renderer(dataEntry, i)
    }), [context, renderer])

    // Do not show button right away if allLoaded is true, it can cause flicker
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [showButton, setShowButton] = useState(false)

    const updateShowButton = useEffectEvent(() => {
        if (!context.state.allLoaded) {
            timerRef.current = setTimeout(() => {
                setShowButton(true)
            }, 500)
        } else {
            setShowButton(false)
        }
    })

    useEffect(() => {
        updateShowButton()
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [state])

    const loadingInfo = (
        <span ref={ref} className={[
            'w-full py-2 relative block h-[40px] mt-[1em] [&_button]:w-auto [&_button]:m-0',
            `[&>*]:h-[40px] [&>*]:absolute [&>*]:top-0 [&>*]:left-0 ${loadingInfoClassName ?? ''}`,
        ].join(' ')}>
            {
                loading ? (
                    <i>Laster inn flere...</i>
                ) : (
                    <>
                        <i style={{ opacity: showButton ? 0 : 1 }}>
                            Ingen flere å laste inn
                        </i>
                        <Button style={{ opacity: showButton ? 1 : 0 }} onClick={loadMoreCallback}>
                            Last inn flere
                        </Button>
                    </>
                )
            }
        </span>
    )

    return (
        <>
            {wrapper(renderedPageData)}
            {loadingInfoWrapper ? loadingInfoWrapper(loadingInfo) : loadingInfo}
        </>
    )
}
