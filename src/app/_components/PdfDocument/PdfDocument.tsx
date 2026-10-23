'use client'
import useViewPort from '@/hooks/useViewPort'
import { useState, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// The worker is bundled and served from this site, so no third-party code runs in its origin.
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type PropTypes = {
    src: string
    className?: string
}

/**
 * A component that displays a PDF document in a book format
 * @param src - The path (relative to domain) to the PDF document
 * @param className - The class name of the component to add extra styling
 */
export default function PdfDocument({ src, className }: PropTypes) {
    const [numPages, setNumPages] = useState<number | null>(null)
    const [pagePair, setPagePair] = useState<number>(0)
    const currentPages = pagesOfPair(numPages, pagePair)
    const [pageWidthLeft, setPageWidthLeft] = useState<number | null>(null)
    const [pageWidthRight, setPageWidthRight] = useState<number | null>(null)
    const [pageHeight, setPageHeight] = useState<number>(20)
    const leftPageRef = useRef<HTMLDivElement>(null)
    const rightPageRef = useRef<HTMLDivElement>(null)
    const [loadingPage, setLoadingPage] = useState<boolean>(true)


    const handleLoadSuccess = () => {
        setLoadingPage(false)
    }

    const handleSetPagePairNumber = (pageNumber: number) => {
        setLoadingPage(true)
        setPagePair(pageNumber)
    }

    const onDocumentLoadSuccess = ({ numPages: numPagesCount }: { numPages: number }) => {
        setNumPages(numPagesCount)
    }

    useViewPort(() => {
        if (leftPageRef.current) setPageWidthLeft(leftPageRef.current.offsetWidth)
        if (rightPageRef.current) setPageWidthRight(rightPageRef.current.offsetWidth)
        if (!loadingPage) {
            setPageHeight(leftPageRef.current?.offsetHeight || rightPageRef.current?.offsetHeight || 0)
        }
    })

    const getPageNumberText = (rightPage: number | null, leftPage: number | null) => {
        if (rightPage && leftPage) return `Side ${leftPage} og ${rightPage} av ${numPages}`
        if (leftPage) return `Side ${leftPage} av ${numPages}`
        if (rightPage) return `Side ${rightPage} av ${numPages}`
        return ''
    }

    if (typeof window !== 'undefined' && !window.Promise.withResolvers) {
        return (
            <>
                <p className="text-accent-red">
                Din nettleser støtter ikke vevens fantastiske PDF-løsning. Bruker alternativ løsning.
                </p>
                <embed className="w-[70%] h-[90vh]" src={src} type="application/pdf" />
            </>
        )
    }

    return (
        <div className={`
            ${className}
        `}>
            <Document
                file={src}
                onLoadSuccess={onDocumentLoadSuccess}
            >
                <div className="flex">
                    <div className="
                        w-1/2 flex
                        [&>button]:bg-surface-raised [&>button]:border-none [&>button]:p-[1em]
                        [&>button_svg]:text-text
                        [&>button]:transition-[background-color] [&>button]:duration-300
                        [&>button_svg]:size-[25px]
                        [&>button:hover]:bg-surface-hover [&>button:hover]:cursor-pointer
                        [&>button]:rounded-l-round
                    ">
                        {
                            currentPages.leftPage && (
                                <button
                                    onClick={() => handleSetPagePairNumber(pagePair - 1)}
                                >
                                    <FontAwesomeIcon icon={faChevronLeft} />
                                </button>
                            )
                        }
                        <div ref={leftPageRef} className="
                            w-full
                            [&_p]:w-full [&_p]:flex [&_p]:justify-center [&_p]:items-center
                        ">
                            {
                                loadingPage && (
                                    <p style={{ height: pageHeight }}>Laster...</p>
                                )
                            }
                            {
                                currentPages.leftPage && (
                                    <div style={{ display: loadingPage ? 'none' : 'block' }}>
                                        <Page
                                            width={pageWidthLeft || undefined}
                                            key={currentPages.leftPage}
                                            pageNumber={currentPages.leftPage}
                                            onLoadSuccess={handleLoadSuccess}
                                        />
                                    </div>
                                )
                            }
                        </div>
                    </div>
                    <div className="
                        w-1/2 flex
                        [&>button]:bg-surface-raised [&>button]:border-none [&>button]:p-[1em]
                        [&>button_svg]:text-text
                        [&>button]:transition-[background-color] [&>button]:duration-300
                        [&>button_svg]:size-[25px]
                        [&>button:hover]:bg-surface-hover [&>button:hover]:cursor-pointer
                        [&>button]:rounded-r-round
                    ">
                        <div ref={rightPageRef} className="
                            w-full
                            [&_p]:w-full [&_p]:flex [&_p]:justify-center [&_p]:items-center
                        ">
                            {
                                loadingPage && (
                                    <p style={{ height: pageHeight }}>Laster...</p>
                                )
                            }
                            {
                                currentPages.rightPage && (
                                    <div style={{ display: loadingPage ? 'none' : 'block' }}>
                                        <Page
                                            width={pageWidthRight || undefined}
                                            key={currentPages.rightPage}
                                            pageNumber={currentPages.rightPage}
                                            onLoadSuccess={handleLoadSuccess}
                                        />
                                    </div>
                                )
                            }
                        </div>
                        {
                            currentPages.rightPage && currentPages.rightPage !== numPages && (
                                <button
                                    onClick={() => handleSetPagePairNumber(pagePair + 1)}
                                >
                                    <FontAwesomeIcon icon={faChevronRight} />
                                </button>
                            )
                        }
                    </div>
                </div>
            </Document>
            <p style={{ transform: pagePair === 0 ? `translateX(${pageWidthLeft}px)` : undefined }}>
                {getPageNumberText(currentPages.rightPage, currentPages.leftPage)}
            </p>
        </div>
    )
}

function pagesOfPair(numPages: number | null, pagePair: number): { leftPage: number | null, rightPage: number | null } {
    if (!numPages) return { leftPage: null, rightPage: null }
    if (pagePair === 0) return { leftPage: null, rightPage: 1 }
    if (2 * pagePair === numPages) return { leftPage: numPages, rightPage: null }
    return { leftPage: 2 * pagePair, rightPage: 2 * pagePair + 1 }
}
