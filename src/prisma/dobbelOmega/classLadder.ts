import { migratedOrder } from './migratedOrder'
import manifest from './manifest'

/**
 * One class membership of a migrated user: the year of study (1-5, 6 being siving) and the order
 * the user was in that year.
 */
export type ClassRung = { year: number, order: number, active: boolean }

type OwStudent = {
    id: number,
    /** The order the user was taken up in. */
    order: number,
    /** The year of study omegaweb-basic has the user in now. */
    yearOfStudy: number,
    /** The length of the user's study programme - 0 when they have none. */
    yearsInProgramme: number,
}

/**
 * The ladder as omegaweb-basic's data has it: one rung per year of study the user has been through,
 * each of the order they were in that year. Which years exist and which order the ladder is anchored
 * on depends on the length of the programme.
 */
function rawLadder(user: OwStudent): ClassRung[] {
    switch (user.yearsInProgramme) {
        case 0:
            manifest.error(`User ${user.id} has no years in programme or no programme`)
            return []
        case 2: {
            //ASSUME 2 years masters. The user can be member of 4 5 and 6 (siving)
            let yearOfStudy = user.yearOfStudy
            if (yearOfStudy < 4) {
                manifest.error(
                    `User ${user.id} is in 2 year programme but has year of study less than 4 - setting to 4`
                )
                yearOfStudy = 4
            }
            // Anything past year 6 (siving) just means the user graduated a while ago and OW
            // kept incrementing yearOfStudy - not a data error, so no active membership either.
            const graduated = yearOfStudy > 6
            if (graduated) yearOfStudy = 6
            // Year 4 in the order the user was taken up in, and one order per year up from there.
            return Array.from({ length: yearOfStudy - 3 }, (_, index) => {
                const year = 4 + index
                return { year, order: user.order + index, active: year === yearOfStudy && !graduated }
            })
        }
        case 3: {
            //ASSUME 3 years bachelors. The user can be member of 1 2 and 3, and cannot be siving.
            let yearOfStudy = user.yearOfStudy
            if (yearOfStudy < 1) {
                manifest.error(`User ${user.id} has year of study less than 1 - setting to 1`)
                yearOfStudy = 1
            }
            if (yearOfStudy > 3) {
                manifest.error(`User ${user.id} has year of study greater than 3 - setting to 3`)
                yearOfStudy = 3
            }
            // The year the user is in now in the order they were taken up in, and one order per year
            // back from there. Year 3 is a nut - it is hard to say if the user still is in 3. grade.
            // We will assume that the user is in 3. grade if the order is gte 103
            return Array.from({ length: yearOfStudy }, (_, index) => {
                const year = 1 + index
                return {
                    year,
                    order: user.order - (yearOfStudy - year),
                    active: year === yearOfStudy && (year !== 3 || user.order >= 103),
                }
            })
        }
        case 5: {
            // Assuming 5 year masters. The user can be member of 1 2 3 4 5 and 6 (siving)
            let yearOfStudy = user.yearOfStudy
            if (yearOfStudy < 1) {
                manifest.error(
                    `User ${user.id} is in 5 year programme but has year of study less than 1 - setting to 1`
                )
                yearOfStudy = 1
            }
            // Anything past year 6 (siving) just means the user graduated a while ago and OW
            // kept incrementing yearOfStudy - not a data error, so no active membership either.
            const graduated = yearOfStudy > 6
            if (graduated) yearOfStudy = 6
            // Year 1 in the order the user was taken up in, and one order per year up from there.
            return Array.from({ length: yearOfStudy }, (_, index) => {
                const year = 1 + index
                return { year, order: user.order + index, active: year === yearOfStudy && !graduated }
            })
        }
        default:
            manifest.error(`User ${user.id} has ${user.yearsInProgramme} years in programme - dobbelOmega failed :(`)
            return []
    }
}

/**
 * The class memberships a migrated user holds, inferred from the order they were taken up in, the
 * length of their programme and the year of study omegaweb-basic has them in. Every rung is of an
 * order that exists, and no two rungs share one.
 *
 * A ladder can reach outside the orders that exist - past the current one for a user who was taken
 * up in it but is in their third year and came in from somewhere else, and below the first one for
 * a user omegaweb-basic has no order for at all. Those rungs are brought onto the nearest order
 * there is (and reported, by `migratedOrder`). A user holds one class per order, so of the rungs
 * that then share an order only the highest year is kept: the one omegaweb-basic says they are in
 * now, which is what the bump reads.
 */
export function inferClassLadder(user: OwStudent): ClassRung[] {
    // The raw ladder is ascending by year, so a later rung on the same order is the higher year.
    const rungByOrder = new Map<number, ClassRung>()
    rawLadder(user).forEach(rung => {
        const order = migratedOrder(rung.order, `User ${user.id} in year ${rung.year}`)
        rungByOrder.set(order, { ...rung, order })
    })
    return Array.from(rungByOrder.values())
}
