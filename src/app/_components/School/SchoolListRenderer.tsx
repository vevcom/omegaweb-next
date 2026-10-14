import School from './School'
import type { ExpandedSchool } from '@/services/education/schools/types'

/**
 * Used to render schools server side and client side in consistent manner
 * @param school - school to render
 * @returns
 */
export const schoolListRenderer = (school: ExpandedSchool) => <School key={school.shortName} school={school} />
