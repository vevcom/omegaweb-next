import { readFileSync } from 'fs'

/** The id of the Next build that runs, the same in every process of one build, or `development` outside one. */
export function buildId() {
    try {
        return readFileSync('.next/BUILD_ID', 'utf8').trim()
    } catch {
        return 'development'
    }
}
