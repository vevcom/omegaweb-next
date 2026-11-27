/**
 * Every key any member of a union has. `keyof` of a union gives only the keys all its members
 * share, so a field one member alone has is missing from it.
 */
export type KeysOfUnion<Union> = Union extends unknown ? keyof Union : never
