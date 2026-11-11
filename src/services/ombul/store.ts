import '@pn-server-only'
import { implementStore } from '@/services/store/implement'

/** The pdfs of the ombul issues. An ombul refers to its own as its file. */
export const ombulStore = implementStore({
    purpose: 'OMBUL',
    allowedExtensions: ['pdf'],
    preferredLocation: 'S3',
    owners: ['ombul'],
})
