export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

let currentLevel: LogLevel = 'warn';

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

export function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  if (levelOrder[level] < levelOrder[currentLevel]) {
    return;
  }
  const payload = context ? `${message} ${JSON.stringify(context)}` : message;
  switch (level) {
    case 'debug':
      console.debug(payload);
      break;
    case 'info':
      console.info(payload);
      break;
    case 'warn':
      console.warn(payload);
      break;
    case 'error':
      console.error(payload);
      break;
    default:
      console.log(payload);
  }
}
