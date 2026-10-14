'use client'
import styles from './LockerList.module.scss'
import LockerRow from './LockerRow'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { LockerPagingContext } from '@/contexts/paging/LockerPaging'

export default function LockerList() {
    return (
        <div className={styles.LockerList} role="table">
            <div className={`${styles.row} ${styles.headerRow}`} role="row">
                <span className={styles.colId} role="columnheader">Skap</span>
                <span className={styles.colLocation} role="columnheader">Sted</span>
                <span className={styles.colUser} role="columnheader">Reservert av</span>
                <span className={styles.colGroup} role="columnheader">For</span>
                <span className={styles.colEnd} role="columnheader">Til</span>
            </div>
            <div className={styles.body} role="rowgroup">
                <EndlessScroll
                    pagingContext={LockerPagingContext}
                    renderer={locker => <LockerRow locker={locker} key={locker.id} />}
                />
            </div>
        </div>
    )
}
