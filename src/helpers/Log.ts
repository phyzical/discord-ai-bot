import { AxiosError } from 'axios';
import { Logger, LogLevel } from 'meklog';

//  TODO: stop needing to hardcode this to false, use the config flag
const log = new Logger(false, 'Generic logs');

const timestamp = (): string => {
  const date = new Date();

  return `[${date.toLocaleDateString()} ${date.toLocaleTimeString()}]`;
};

export const logError = (error: Error | AxiosError): void => {
  let str = error as unknown as string;
  if (error instanceof AxiosError) {
    str =
      `Error ${error.response?.status} ` +
      `${error.response?.statusText}: ${error.request?.method} ` +
      `${error.request?.path}`;
    if (error.response?.data?.error) str += ': ' + error.response?.data?.error;
  }
  log(LogLevel.Error, `${timestamp()} ${str}`);
  log(LogLevel.Error, error.stack);
};

export const logDebug = (str: string): void => {
  log(LogLevel.Debug, `${timestamp()} ${str}`);
};
