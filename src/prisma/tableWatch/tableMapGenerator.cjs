#!/usr/bin/env node
// A Prisma generator: `prisma generate` runs it and it writes the table map, which is what the table
// watcher needs of the schema and the client's own data model leaves out. It speaks the generator
// protocol itself: a JSON-RPC request on each line of stdin, and the answer on stderr.
const fs = require('fs')
const path = require('path')
const readline = require('readline')

readline.createInterface({ input: process.stdin }).on('line', line => {
    const request = JSON.parse(line)
    if (request.method === 'getManifest') {
        answer(request.id, { manifest: { prettyName: 'Table map', defaultOutput: '../../../generated/table-map' } })
    }
    if (request.method === 'generate') {
        const output = request.params.generator.output.value
        fs.mkdirSync(output, { recursive: true })
        fs.writeFileSync(path.join(output, 'tableMap.ts'), [
            types,
            `export const tableMap: TableMap = ${JSON.stringify(tableMapOf(request.params.dmmf.datamodel.models), null, 4)}`,
            '',
        ].join('\n'))
        answer(request.id, null)
    }
})

function answer(id, result) {
    process.stderr.write(`${JSON.stringify({ jsonrpc: '2.0', result, id })}\n`)
}

function tableMapOf(models) {
    const modelOf = Object.fromEntries(models.map(model => [model.name, model]))
    const tableOf = model => model.dbName ?? model.name
    const fieldOf = (model, name) => model.fields.find(field => field.name === name)
    const columnsOf = (model, names) => names.map(name => fieldOf(model, name).dbName ?? name)

    return Object.fromEntries(models.map(model => [model.name, {
        table: tableOf(model),
        idFields: model.primaryKey?.fields ?? model.fields.filter(field => field.isId).map(field => field.name),
        relations: Object.fromEntries(model.fields.filter(field => field.kind === 'object').map(field => {
            const other = modelOf[field.type]
            // A relation of a model to itself with one field has no other side.
            const otherSide = other.fields.find(each => each.relationName === field.relationName && each !== field) ?? field
            const relation = { model: other.name, table: tableOf(other), list: field.isList }
            if (field.isList && otherSide.isList) {
                return [field.name, { ...relation, kind: 'manyToMany', joinTable: `_${field.relationName}` }]
            }

            const holdsKey = field.relationFromFields.length > 0
            const [keyModel, key, referenced] = holdsKey ? [model, field, other] : [other, otherSide, model]
            const isRequired = key.relationFromFields.every(name => fieldOf(keyModel, name).isRequired)
            return [field.name, {
                ...relation,
                kind: 'key',
                keyOn: holdsKey ? 'this' : 'other',
                keyFields: key.relationFromFields,
                keyColumns: columnsOf(keyModel, key.relationFromFields),
                referencedFields: key.relationToFields,
                referencedColumns: columnsOf(referenced, key.relationToFields),
                // Prisma's defaults, which the schema leaves unsaid.
                onDelete: key.relationOnDelete ?? (isRequired ? 'Restrict' : 'SetNull'),
                onUpdate: key.relationOnUpdate ?? 'Cascade',
            }]
        })),
    }]))
}

const types = `// Written by src/prisma/tableWatch/tableMapGenerator.cjs on \`prisma generate\`. Do not edit.
export type ReferentialAction = 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault'

/** A relation as one model sees it. The names of tables and columns are the database's. */
export type RelationOfTableMap = { model: string, table: string, list: boolean } & (
    | { kind: 'manyToMany', joinTable: string }
    | {
        kind: 'key',
        /** Which side holds the foreign key: this model or the one the relation leads to. */
        keyOn: 'this' | 'other',
        keyFields: string[],
        keyColumns: string[],
        referencedFields: string[],
        referencedColumns: string[],
        /** What the database does to the rows holding the key when the row they refer to is deleted. */
        onDelete: ReferentialAction,
        /** And when a column they refer to is changed. */
        onUpdate: ReferentialAction,
    }
)

export type ModelOfTableMap = { table: string, idFields: string[], relations: Record<string, RelationOfTableMap> }

/** By the name of the model. */
export type TableMap = Record<string, ModelOfTableMap>
`
