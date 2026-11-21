/**
 * Each check of a migration as a statement of its own, read with its parentheses balanced. The
 * suite's database is pushed from the schema, which holds no checks, so a test adds them from here.
 */
export function checksOf(sql: string) {
    const check = /CONSTRAINT "((\w+?)_\w+_check)" CHECK \(/g
    const statements: string[] = []
    for (let found = check.exec(sql); found; found = check.exec(sql)) {
        const opens = found.index + found[0].length - 1
        let depth = 0
        let closes = opens
        do {
            if (sql[closes] === '(') depth += 1
            if (sql[closes] === ')') depth -= 1
            closes += 1
        } while (depth > 0)
        statements.push(`ALTER TABLE "${found[2]}" ADD CONSTRAINT "${found[1]}" CHECK ${sql.slice(opens, closes)}`)
    }
    return statements
}
