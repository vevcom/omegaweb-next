import PageTitleSetter from '@/contexts/PageTitleSetter'
import StandardImageServer from '@/components/Image/StandardImageServer'

export default function Error404() {
    return (
        <div className="flex-1 flex flex-col justify-center items-center min-h-[50vh] bg-surface-base px-4">
            <PageTitleSetter title={'Side ikke funnet'} />
            <div className="flex justify-center items-center max-mobile:min-h-[50vh] [&_h3]:text-text">
                <div className="border-r-2 border-solid border-surface-base pr-[20px] mr-[20px]">
                    <StandardImageServer
                        standardImage="LOGO_SIMPLE"
                        width={60}
                        tint="var(--text)"
                    />
                </div>
                <h3>404 - Side ikke funnet</h3>
            </div>
        </div>
    )
}
