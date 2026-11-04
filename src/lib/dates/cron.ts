
function divideCronString(cronExpression: string) {
    const ret = []

    const splitted = cronExpression.split(' ')
    for (const part of splitted) {
        if (part.trim().length > 0) {
            ret.push(part.replaceAll(' ', ''))
        }
    }

    if (ret.length !== 3) throw new Error('Cron-uttrykket er ugyldig. Det må ha tre deler.')

    return ret
}

function createArrayFromRange(start: number, end: number) {
    const ret: number[] = []

    for (let i = start; i < end; i++) {
        ret.push(i)
    }

    return ret
}

function numberInCronExpression(number: number, cronExpressionPart: string) {
    if (!(/^[\*\d\-\,\/]+$/.exec(cronExpressionPart))) {
        throw new Error('The cron expression is invalid. Can only contain numbers, *, - and /')
    }
    // I guess the cron is parsed in this order: comma, step, range
    const commaSplit = cronExpressionPart.split(',')

    function parseCronRange(input: string): number[] {
        const parts = input.split('-')
        if (parts.length > 2) {
            throw new Error('Cron-uttrykket er ugyldig. Det inneholder en ugyldig -.')
        }

        if (parts.length === 1 && parts[0] === '*') {
            return createArrayFromRange(0, 32) // 31 is the maximum number that can appear
        }

        const startNumber = parseInt(parts[0], 10)

        if (parts.length === 1) {
            return [startNumber]
        }

        const endNumber = parseInt(parts[1], 10)
        if (startNumber >= endNumber) {
            throw new Error('Cron-uttrykket er ugyldig. Intervallet må være stigende.')
        }

        return createArrayFromRange(startNumber, endNumber + 1)
    }

    const validNumbers = commaSplit.map(commaPart => {
        const parts = commaPart.split('/')
        if (parts.length > 2) {
            throw new Error('Cron-uttrykket er ugyldig. Det inneholder en ugyldig /.')
        }

        let result = parseCronRange(parts[0])

        if (parts.length === 2) {
            const divisor = parseInt(parts[1], 10)
            // BUG: The syntax 20/2 is not supported. This should return every even number from 20 to 30.
            // Now this will only return 20
            result = result.filter(num => (num % divisor) === 0)
        }
        return result
    }).flat()

    return validNumbers.includes(number)
}

export function dateMatchCron(day: Date, cronExpression: string) {
    // Croninterval syntac: (day of month, month, day of week)
    const cronParsed = divideCronString(cronExpression)

    if (!numberInCronExpression(day.getUTCDate(), cronParsed[0])) return false
    if (!numberInCronExpression(day.getUTCMonth() + 1, cronParsed[1])) return false
    if (!numberInCronExpression(day.getUTCDay(), cronParsed[2])) return false
    return true
}
