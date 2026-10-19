import winston from 'winston'
import 'winston-daily-rotate-file'

const logger = winston.createLogger()

if (process.env.LOG_TO_CONSOLE === 'true') {
    logger.add(new winston.transports.Console({
        level: process.env.LOG_CONSOLE_LEVEL || 'info',
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
                return `${timestamp} ${level}: ${message}${metaString}`
            }),
        ),
    }))
}

if (process.env.LOG_TO_FILE === 'true') {
    logger.add(new winston.transports.DailyRotateFile({
        dirname: './logs',
        filename: '%DATE%.log',
        level: process.env.LOG_FILE_LEVEL || 'info',
        datePattern: 'YYYY-MM-DD',
        maxFiles: process.env.LOG_MAX_FILES,
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
        ),
    }))
}

export default logger
