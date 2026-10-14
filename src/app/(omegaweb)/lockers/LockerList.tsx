'use client'
import LockerRow, { lockerColumnClassName, lockerRowClassName } from './LockerRow'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { LockerPagingContext } from '@/contexts/paging/LockerPaging'

export default function LockerList() {
    return (
        <div className="w-full my-4 rounded-round overflow-hidden shadow-soft text-m" role="table">
            <div className={`
                ${lockerRowClassName}
                text-ink-strong font-medium
            `} role="row">
                <span className={lockerColumnClassName.id} role="columnheader">Skap</span>
                <span className={lockerColumnClassName.location} role="columnheader">Sted</span>
                <span className={lockerColumnClassName.user} role="columnheader">Reservert av</span>
                <span className={lockerColumnClassName.group} role="columnheader">For</span>
                <span className={lockerColumnClassName.end} role="columnheader">Til</span>
            </div>
            <div className="flex flex-col" role="rowgroup">
                <EndlessScroll
                    pagingContext={LockerPagingContext}
                    renderer={locker => <LockerRow locker={locker} key={locker.id} />}
                />
            </div>
        </div>
    )
}
