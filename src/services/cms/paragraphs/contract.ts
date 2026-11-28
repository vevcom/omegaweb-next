import { cmsParagraphSchemas } from './schemas'
import { defineSubContract } from '@/services/serviceContract'

export const cmsParagraphContract = defineSubContract({
    updateContent: {
        params: cmsParagraphSchemas.params.updateContent,
        data: cmsParagraphSchemas.data.updateContent,
    },
})
