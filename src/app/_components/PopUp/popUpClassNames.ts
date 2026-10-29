export const popUpClassNames = {
    popUp: `
        fixed inset-0 z-8 bg-[rgba(0,0,0,0.55)]
        mobile:backdrop-blur-[2px]
    `,
    // A flex column, so the scrolling part gets the height left once the padding has taken its
    // share, whatever that padding is. On mobile the pop-up is a sheet pinned to the bottom edge.
    main: `
        absolute z-9 flex flex-col w-min max-h-[95svh] p-6 rounded-round bg-surface-base
        mobile:top-1/2 mobile:left-1/2 mobile:-translate-x-1/2 mobile:-translate-y-1/2
        max-mobile:bottom-0 max-mobile:left-0 max-mobile:w-[100svw] max-mobile:rounded-b-none
        max-mobile:pb-[calc(1.5rem+env(safe-area-inset-bottom))]
    `,
    overflow: 'flex-1 min-h-0 overflow-x-visible overflow-y-auto m-0 p-0',
    closeBtn: `
        close-btn absolute
        mobile:top-[calc(-48px-var(--gap))] mobile:left-0
        max-mobile:-top-14 max-mobile:left-4
    `,
}
