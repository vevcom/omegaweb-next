import type { mailHandlerSingleton } from '@/services/mail/send/mailHandler'

declare global {

   var mailHandler: ReturnType<typeof mailHandlerSingleton>
}
