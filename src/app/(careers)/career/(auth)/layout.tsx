import type { ReactNode } from 'react'

export default function CareersAuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex justify-center py-16">
            <div className="
                w-full max-w-[460px] flex flex-col gap-2 p-8 rounded-[calc(var(--rounding)/2)] border border-careers-line
                bg-base-200
                [&>*]:w-full
                [&_h1]:text-xl [&_h1]:text-careers-navy
            ">
                {children}
            </div>
        </div>
    )
}
