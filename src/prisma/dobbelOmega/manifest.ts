import winston from 'winston'

/**
 * Logger for the manifest the dobbelOmega migration
 */
const manifest = winston.createLogger({
    level: 'silly',
})

const plainFormat = winston.format.printf(({ level, message }) => `${level}: ${message}`)

manifest.add(new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), plainFormat),
}))

manifest.add(new winston.transports.File({
    filename: 'manifest.log',
    dirname: 'dobbelOmegaManifest',
    format: plainFormat,
}))

export default manifest
