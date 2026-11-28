import { implementParagraphEditor } from '@/components/Cms/CmsParagraph/DeclaredParagraphEditor'
import { Form } from '@/components/Form/Declared/Form'
import { Require } from '@/auth/authorizer/Require'
import { makeAction } from '@/services/serverAction'
import { defineCapabilities, defineContract, defineSubContract } from '@/services/serviceContract'
import { defineSubOperation } from '@/services/serviceOperation'
import { z } from 'zod'

// Checked by `npx tsc --noEmit` and never run, so jest does not match its name. The
// `@ts-expect-error` lines are the test: tsc fails on any of them that stops being an error.

const paragraphId = z.object({ paragraphId: z.number() })
const markdown = z.object({ markdown: z.string() })
const permitted = Require.permission('USERS_ADMIN')
const ownedByUser = Require.userId().permission('USERS_ADMIN')

const paragraphContract = defineSubContract({
    updateContent: { params: paragraphId, data: markdown },
    updateById: { params: z.object({ id: z.number() }), data: markdown },
    updateName: { params: paragraphId, data: z.object({ name: z.string() }) },
    updateWithoutData: { params: paragraphId },
})

const paragraphOperations = {
    updateContent: defineSubOperation(paragraphContract.updateContent, { operation: ({ data }) => data.markdown }),
    updateById: defineSubOperation(paragraphContract.updateById, { operation: ({ data }) => data.markdown }),
    updateName: defineSubOperation(paragraphContract.updateName, { operation: ({ data }) => data.name }),
    updateWithoutData: defineSubOperation(paragraphContract.updateWithoutData, { operation: () => '' }),
}

const ownerContract = defineContract({
    updateParagraph: paragraphContract.updateContent.implement({ authorizer: permitted }),
    updateBio: paragraphContract.updateContent.implement({
        implementationParams: z.object({ userId: z.number() }),
        authorizer: ownedByUser,
    }),
    updateById: paragraphContract.updateById.implement({ authorizer: permitted }),
    updateName: paragraphContract.updateName.implement({ authorizer: permitted }),
    updateWithoutData: paragraphContract.updateWithoutData.implement({ authorizer: permitted }),
})

const ownerCapabilities = defineCapabilities(ownerContract, {
    updateParagraph: makeAction(paragraphOperations.updateContent.implement(ownerContract.updateParagraph, {
        ownershipCheck: () => true,
    })),
    updateBio: makeAction(paragraphOperations.updateContent.implement(ownerContract.updateBio, {
        authorizerData: ({ implementationParams }) => ({ userId: implementationParams.userId }),
        ownershipCheck: () => true,
    })),
    updateById: makeAction(paragraphOperations.updateById.implement(ownerContract.updateById, {
        ownershipCheck: () => true,
    })),
    updateName: makeAction(paragraphOperations.updateName.implement(ownerContract.updateName, {
        ownershipCheck: () => true,
    })),
    updateWithoutData: makeAction(paragraphOperations.updateWithoutData.implement(ownerContract.updateWithoutData, {
        ownershipCheck: () => true,
    })),
})

const paragraph = { id: 1, contentMd: '', contentHtml: '<p>Hei</p>' }

// The paragraph editor, bound once per owner. Each owner gives its own implementation params.

export const ParagraphEditor = implementParagraphEditor({ capability: ownerCapabilities.updateParagraph })
export const BioEditor = implementParagraphEditor({ capability: ownerCapabilities.updateBio })

export const takenByEditors = <>
    <ParagraphEditor cmsParagraph={paragraph} />
    <BioEditor cmsParagraph={paragraph} implementationParams={{ userId: 1 }} authorizerData={{ userId: 1 }} />
</>

// @ts-expect-error A capability whose params are not a paragraph's id.
export const EditorById = implementParagraphEditor({ capability: ownerCapabilities.updateById })
// @ts-expect-error A capability whose data is not markdown.
export const NameEditor = implementParagraphEditor({ capability: ownerCapabilities.updateName })
// @ts-expect-error A capability that takes no data.
export const EditorWithoutData = implementParagraphEditor({ capability: ownerCapabilities.updateWithoutData })

export const refusedByEditors = <>
    {/* @ts-expect-error The owner's implementation params cannot be left out. */}
    <BioEditor cmsParagraph={paragraph} authorizerData={{ userId: 1 }} />
    {/* @ts-expect-error The owner's implementation params are its own: a user id is a number. */}
    <BioEditor cmsParagraph={paragraph} implementationParams={{ userId: '1' }} authorizerData={{ userId: 1 }} />
    {/* @ts-expect-error The owner's implementation params are its own, and not another's. */}
    <BioEditor cmsParagraph={paragraph} implementationParams={{ id: 1 }} authorizerData={{ userId: 1 }} />
    {/* @ts-expect-error An owner without implementation params is given none. */}
    <ParagraphEditor cmsParagraph={paragraph} implementationParams={{ userId: 1 }} />
    {/* @ts-expect-error The owner's rule needs a user id. */}
    <BioEditor cmsParagraph={paragraph} implementationParams={{ userId: 1 }} />
</>

// The submitter of an owner's implementation takes its implementation params beside its params.

export const [BioSubmitter, BioField] = Form.Submitter({ capability: ownerCapabilities.updateBio })
export const [ParagraphSubmitter] = Form.Submitter({ capability: ownerCapabilities.updateParagraph })

export const takenBySubmitters = <>
    <BioSubmitter implementationParams={{ userId: 1 }} params={{ paragraphId: 1 }} authorizerData={{ userId: 1 }} autosave>
        <BioField kind="richText" name="markdown" label="Innhold" />
    </BioSubmitter>
    <ParagraphSubmitter params={{ paragraphId: 1 }} />
</>

export const refusedBySubmitters = <>
    {/* @ts-expect-error The implementation params cannot be left out. */}
    <BioSubmitter params={{ paragraphId: 1 }} authorizerData={{ userId: 1 }} />
    {/* @ts-expect-error The implementation params are the capability's. */}
    <BioSubmitter implementationParams={{ userId: '1' }} params={{ paragraphId: 1 }} authorizerData={{ userId: 1 }} />
    {/* @ts-expect-error A capability without implementation params is given none. */}
    <ParagraphSubmitter implementationParams={{ userId: 1 }} params={{ paragraphId: 1 }} />
</>
