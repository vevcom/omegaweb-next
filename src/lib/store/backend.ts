import '@pn-server-only'
import { storeS3Config } from './constants'
import { fileSystemBackend } from './fileSystemBackend'
import { createS3Backend } from './s3Backend'
import type { StoreBackend } from './types'

export const storeBackend: StoreBackend = storeS3Config ? createS3Backend(storeS3Config) : fileSystemBackend
