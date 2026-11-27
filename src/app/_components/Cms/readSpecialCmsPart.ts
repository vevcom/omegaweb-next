import '@ow-server-only'
import { serviceErrorOf, withPageSession } from '@/app/ServerPage'

type SpecialCmsPartRead<Part> = { success: true, part: Part } | { success: false, message: string }

/**
 * Reads a special cms part for the server component that shows it, with the owning service's read
 * operation. A service error comes back as its message, so the component can show it in place of
 * the part without taking the page down.
 */
export async function readSpecialCmsPart<Part>(read: () => Promise<Part>): Promise<SpecialCmsPartRead<Part>> {
    try {
        return { success: true, part: await withPageSession(read) }
    } catch (error) {
        const serviceError = serviceErrorOf(error)
        return { success: false, message: serviceError.errors[0]?.message ?? serviceError.errorCode }
    }
}
