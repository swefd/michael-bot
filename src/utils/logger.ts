type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'warn';
const currentLevelNum = levels[currentLevel];

export const logger = {
    debug: (message: string, ...args: any[]) => {
        if (currentLevelNum <= levels.debug) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    },
    info: (message: string, ...args: any[]) => {
        if (currentLevelNum <= levels.info) {
            console.log(`[INFO] ${message}`, ...args);
        }
    },
    warn: (message: string, ...args: any[]) => {
        if (currentLevelNum <= levels.warn) {
            console.warn(`[WARN] ${message}`, ...args);
        }
    },
    error: (message: string, ...args: any[]) => {
        if (currentLevelNum <= levels.error) {
            console.error(`[ERROR] ${message}`, ...args);
        }
    },
    // Always visible logs (use sparingly)
    log: (message: string, ...args: any[]) => {
        console.log(message, ...args);
    }
};
