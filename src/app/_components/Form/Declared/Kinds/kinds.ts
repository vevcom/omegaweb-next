import { booleanKind } from './BooleanKind'
import { dateKind } from './DateKind'
import { numberKind } from './NumberKind'
import { richTextKind } from './RichTextKind'
import { selectKind } from './SelectKind'
import { stringKind } from './StringKind'
import { textKind } from './TextKind'

/** Every kind of field. A kind is a file in this folder and a line here. */
export const kinds = {
    string: stringKind,
    text: textKind,
    number: numberKind,
    boolean: booleanKind,
    date: dateKind,
    select: selectKind,
    richText: richTextKind,
}
