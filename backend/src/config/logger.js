const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');

const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, stage, ...meta }) => {
    const stageTag = stage ? ` [${stage.toUpperCase()}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level.toUpperCase()}${stageTag}: ${message}${metaStr}`;
  })
);

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        logFormat
      )
    }),
    new transports.DailyRotateFile({
      dirname: logDir,
      filename: 'pipeline-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      zippedArchive: true
    }),
    new transports.DailyRotateFile({
      dirname: logDir,
      filename: 'pipeline-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      zippedArchive: true
    })
  ]
});

module.exports = logger;
