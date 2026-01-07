/**
 * Structured logging utility with environment-aware log levels.
 * Production: errors and warnings only. Development: all levels.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    data?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const isProduction = process.env.NODE_ENV === 'production';
const minLevel = isProduction ? LOG_LEVELS.warn : LOG_LEVELS.debug;

function formatEntry(entry: LogEntry): string {
    if (isProduction) {
        return JSON.stringify(entry);
    }
    const prefix = `[${entry.level.toUpperCase()}]`;
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    return `${prefix} ${entry.message}${dataStr}`;
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (LOG_LEVELS[level] < minLevel) return;

    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...(data && { data }),
    };

    const formatted = formatEntry(entry);

    switch (level) {
        case 'error':
            console.error(formatted);
            break;
        case 'warn':
            console.warn(formatted);
            break;
        default:
            console.log(formatted);
    }
}

export const logger = {
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
    error: (message: string, data?: Record<string, unknown>) => log('error', message, data),
};
