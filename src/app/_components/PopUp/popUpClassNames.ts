export const popUpClassNames = {
    popUp: [
        'fixed top-0 left-0 z-8 bg-[rgba(0,0,0,0.55)]',
        'mobile:w-screen mobile:h-screen mobile:backdrop-blur-[2px] max-mobile:bottom-0',
    ].join(' '),
    main: [
        'w-min max-h-[95svh] p-6 z-9 rounded-round bg-surface-base',
        'mobile:absolute mobile:top-1/2 mobile:left-1/2 mobile:-translate-x-1/2 mobile:-translate-y-1/2',
        'max-mobile:w-[100svw] max-mobile:translate-y-[calc(100svh-100%)] max-mobile:rounded-b-none',
    ].join(' '),
    overflow: 'overflow-x-visible overflow-y-auto m-0 p-0 max-h-[calc(95svh-var(--card-padding)*2)]',
    closeBtn: [
        'close-btn absolute mobile:top-[calc(-48px-var(--gap))] mobile:left-0',
        'max-mobile:-top-14 max-mobile:left-4',
    ].join(' '),
}
