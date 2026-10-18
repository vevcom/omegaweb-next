
/**
 * A function to create the select atr. in prisma from fields. Use a constant array like
 * ```ts
 * const fieldsToExpose = ['id', 'name', 'email'] as const
 * ```
 * and pass it to the function to
 * get the type of the selection. Note that you must spread the array to avoid the readonly
 * nature of const array.
 * @param fieldsToExpose - The fields to expose in an array
 * @returns
 */
export function createSelection<const T extends string>(fieldsToExpose: T[]): Record<T, true> {
    const selection = fieldsToExpose.reduce((prev, field) => ({
        ...prev,
        [field]: true
    }), {} as Record<T, true>)
    return selection
}
