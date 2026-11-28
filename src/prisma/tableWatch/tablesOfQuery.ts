import { tableMap } from '@/prisma-generated-table-map'
import type { ModelOfTableMap, RelationOfTableMap } from '@/prisma-generated-table-map'

/** Tables by their names in the database, or `unknown` where they cannot be told: it may be any. */
export type Tables = ReadonlySet<string> | 'unknown'

export type TablesOfQuery = { read: Tables, written: Tables }

type Found = { read: Set<string>, written: Set<string> }

const readOperations: ReadonlySet<string> = new Set([
    'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy',
])

const writeOperations: ReadonlySet<string> = new Set([
    'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert',
    'delete', 'deleteMany',
])

const relationFilters = ['some', 'every', 'none', 'is', 'isNot']

const referencesByModel = referencesOfTableMap()

/**
 * The tables a call of the Prisma client reads and the tables it writes, from its model, its
 * operation and its args: the model's own, those of every relation the args reach, and those the
 * database writes by itself when a row is deleted or a column a foreign key refers to is changed.
 * Raw SQL names no table here, so what it reads is unknown. `$queryRaw` is taken to write nothing
 * and `$executeRaw` to write anything, so raw SQL that writes is sent with `$executeRaw`. An
 * operation that is not known is taken to do both.
 */
export function tablesOfQuery(modelName: string | undefined, operation: string, args: unknown): TablesOfQuery {
    const model = modelName === undefined ? undefined : tableMap[modelName]
    const isWrite = writeOperations.has(operation)
    if (!model) return { read: 'unknown', written: operation.startsWith('$queryRaw') ? new Set() : 'unknown' }
    if (!isWrite && !readOperations.has(operation)) return { read: 'unknown', written: 'unknown' }

    const found: Found = { read: new Set([model.table]), written: new Set() }
    if (isWrite) {
        found.written.add(model.table)
        if (operation === 'delete' || operation === 'deleteMany') addOfDelete(model, found, new Set())
    }
    if (!isRecord(args)) return found

    addOfQueryArgs(model, args, found)
    if (isWrite) {
        addOfData(model, args.data, found, operation.startsWith('create'))
        addOfData(model, args.create, found, true)
        addOfData(model, args.update, found, false)
    }
    return found
}

/** What `findMany` takes, which is also what a relation in `include` or `select` takes. */
function addOfQueryArgs(model: ModelOfTableMap, args: Record<string, unknown>, found: Found) {
    addOfWhere(model, args.where, found)
    addOfOrderBy(model, args.orderBy, found)
    addOfSelection(model, args.select, found)
    addOfSelection(model, args.include, found)
}

function addOfSelection(model: ModelOfTableMap, selection: unknown, found: Found) {
    if (!isRecord(selection)) return
    for (const [name, selected] of Object.entries(selection)) {
        if (!selected) continue
        if (name === '_count') {
            addOfCount(model, selected, found)
            continue
        }
        const relation = model.relations[name]
        if (!relation) continue
        addRead(relation, found)
        if (isRecord(selected)) addOfQueryArgs(tableMap[relation.model], selected, found)
    }
}

/** `_count: true` counts every relation to many, and `_count: { select }` those it names. */
function addOfCount(model: ModelOfTableMap, count: unknown, found: Found) {
    const counted = isRecord(count) && isRecord(count.select) ? count.select : undefined
    for (const [name, relation] of Object.entries(model.relations)) {
        if (counted ? !counted[name] : !relation.list) continue
        addRead(relation, found)
        const filtered = counted?.[name]
        if (isRecord(filtered)) addOfWhere(tableMap[relation.model], filtered.where, found)
    }
}

function addOfWhere(model: ModelOfTableMap, where: unknown, found: Found) {
    if (Array.isArray(where)) {
        where.forEach(each => addOfWhere(model, each, found))
        return
    }
    if (!isRecord(where)) return
    for (const [name, condition] of Object.entries(where)) {
        if (name === 'AND' || name === 'OR' || name === 'NOT') {
            addOfWhere(model, condition, found)
            continue
        }
        const relation = model.relations[name]
        if (!relation) continue
        addRead(relation, found)
        if (!isRecord(condition)) continue
        const other = tableMap[relation.model]
        // A relation to one is also filtered with the other model's fields straight away.
        addOfWhere(other, condition, found)
        relationFilters.forEach(filter => addOfWhere(other, condition[filter], found))
    }
}

function addOfOrderBy(model: ModelOfTableMap, orderBy: unknown, found: Found) {
    if (Array.isArray(orderBy)) {
        orderBy.forEach(each => addOfOrderBy(model, each, found))
        return
    }
    if (!isRecord(orderBy)) return
    for (const [name, order] of Object.entries(orderBy)) {
        const relation = model.relations[name]
        if (!relation) continue
        addRead(relation, found)
        addOfOrderBy(tableMap[relation.model], order, found)
    }
}

/**
 * The `data` of a write, with the writes nested in it at any depth. Nothing refers to a row that is
 * being created, so only the data of a change sets off what the database does when a key is changed.
 */
function addOfData(model: ModelOfTableMap, data: unknown, found: Found, isCreating: boolean) {
    if (Array.isArray(data)) {
        data.forEach(each => addOfData(model, each, found, isCreating))
        return
    }
    if (!isRecord(data)) return
    const changedFields = new Set<string>()
    for (const [name, value] of Object.entries(data)) {
        const relation = model.relations[name]
        if (!relation) {
            changedFields.add(name)
            continue
        }
        addRead(relation, found)
        if (!isRecord(value)) continue
        const other = tableMap[relation.model]

        for (const created of [value.create, isRecord(value.createMany) ? value.createMany.data : undefined]) {
            if (created === undefined) continue
            found.written.add(relation.table)
            addOfData(other, created, found, true)
            addOfLink(relation, changedFields, found)
        }
        for (const each of listOf(value.connectOrCreate)) {
            found.written.add(relation.table)
            addOfLink(relation, changedFields, found)
            if (!isRecord(each)) continue
            addOfWhere(other, each.where, found)
            addOfData(other, each.create, found, true)
        }
        for (const linked of [value.connect, value.disconnect, value.set]) {
            if (linked === undefined) continue
            addOfLink(relation, changedFields, found)
            listOf(linked).forEach(each => addOfWhere(other, each, found))
        }
        for (const each of [...listOf(value.update), ...listOf(value.updateMany), ...listOf(value.upsert)]) {
            found.written.add(relation.table)
            if (!isRecord(each)) continue
            addOfWhere(other, each.where, found)
            // A relation to one takes the data itself where a relation to many takes `{ where, data }`.
            addOfData(other, each, found, false)
            addOfData(other, each.data, found, false)
            addOfData(other, each.create, found, true)
            addOfData(other, each.update, found, false)
        }
        for (const deleted of [value.delete, value.deleteMany]) {
            if (deleted === undefined || deleted === false) continue
            found.written.add(relation.table)
            addOfDelete(other, found, new Set())
            listOf(deleted).forEach(each => addOfWhere(other, each, found))
        }
    }
    if (!isCreating) addOfKeyChange(model, changedFields, found, new Set())
}

/** A row is tied to another or let go of it, which writes the table that holds the foreign key. */
function addOfLink(relation: RelationOfTableMap, changedFieldsOfThis: Set<string>, found: Found) {
    if (relation.kind === 'manyToMany') {
        found.written.add(relation.joinTable)
    } else if (relation.keyOn === 'this') {
        relation.keyFields.forEach(field => changedFieldsOfThis.add(field))
    } else {
        found.written.add(relation.table)
        addOfKeyChange(tableMap[relation.model], new Set(relation.keyFields), found, new Set())
    }
}

/** What the database does by itself when rows of the model are deleted, which Prisma never sends. */
function addOfDelete(model: ModelOfTableMap, found: Found, followed: Set<ModelOfTableMap>) {
    if (followed.has(model)) return
    followed.add(model)
    for (const reference of referencesTo(model)) {
        if (reference.kind === 'manyToMany') {
            found.written.add(reference.joinTable)
        } else if (reference.onDelete === 'Cascade') {
            found.written.add(reference.from.table)
            addOfDelete(reference.from, found, followed)
        } else if (reference.onDelete === 'SetNull' || reference.onDelete === 'SetDefault') {
            found.written.add(reference.from.table)
            addOfKeyChange(reference.from, new Set(reference.keyFields), found, new Set())
        }
    }
}

/** What the database does by itself when fields that a foreign key refers to are changed. */
function addOfKeyChange(model: ModelOfTableMap, changedFields: Set<string>, found: Found, followed: Set<string>) {
    for (const reference of referencesTo(model)) {
        if (reference.kind === 'manyToMany') {
            if (model.idFields.some(field => changedFields.has(field))) found.written.add(reference.joinTable)
            continue
        }
        if (!reference.referencedFields.some(field => changedFields.has(field))) continue
        if (reference.onUpdate === 'Restrict' || reference.onUpdate === 'NoAction') continue
        const key = `${reference.from.table}.${reference.keyFields.join(',')}`
        if (followed.has(key)) continue
        followed.add(key)
        found.written.add(reference.from.table)
        addOfKeyChange(reference.from, new Set(reference.keyFields), found, followed)
    }
}

function addRead(relation: RelationOfTableMap, found: Found) {
    found.read.add(relation.table)
    if (relation.kind === 'manyToMany') found.read.add(relation.joinTable)
}

type Reference =
    | { kind: 'manyToMany', joinTable: string }
    | (Extract<RelationOfTableMap, { kind: 'key' }> & { from: ModelOfTableMap })

/** The foreign keys that refer to the model, and the join tables it is in. */
function referencesTo(model: ModelOfTableMap): Reference[] {
    return referencesByModel.get(model) ?? []
}

function referencesOfTableMap() {
    const references = new Map<ModelOfTableMap, Reference[]>(Object.values(tableMap).map(model => [model, []]))
    for (const from of Object.values(tableMap)) {
        for (const relation of Object.values(from.relations)) {
            if (relation.kind === 'manyToMany') {
                references.get(from)?.push({ kind: 'manyToMany', joinTable: relation.joinTable })
            } else if (relation.keyOn === 'this') {
                references.get(tableMap[relation.model])?.push({ ...relation, from })
            }
        }
    }
    return references
}

function listOf(value: unknown): unknown[] {
    if (value === undefined) return []
    return Array.isArray(value) ? value : [value]
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
