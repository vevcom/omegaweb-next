import '@pn-server-only'
import { implementStore } from '@/lib/store/implementStore'

/** Where the ombul service keeps its pdfs. */
export const ombulStore = implementStore({
    staticStorePrefix: 'ombul',
    allowedExtentions: ['pdf'],
})
