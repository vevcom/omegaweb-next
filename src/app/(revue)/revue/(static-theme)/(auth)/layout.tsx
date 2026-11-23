import type { ReactNode } from 'react'

export default function RevueAuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex justify-center py-16">
            <div className="
                w-full max-w-[460px] flex flex-col gap-2 p-8 rounded-round bg-base-200
                [&>*]:w-full
                [&_h1]:text-xl
            ">
                {children}
            </div>
        </div>
    )
}
