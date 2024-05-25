import { AxiosError } from 'axios';
import { Logger, LogLevel } from 'meklog';

export const log = new Logger(false, 'Generic logs');
// process.on('message', (data: Client) => {
//   if (data.shardID) client.shardID = data.shardID;
//   if (data.logger) log = new Logger(data.logger);
// });

export const logError = (error: Error | AxiosError): void => {
  let str = error as unknown as string;
  if (error instanceof AxiosError) {
    str =
      `Error ${error.response.status} ` +
      `${error.response.statusText}: ${error.request.method} ` +
      `${error.request.path}`;
    if (error.response.data?.error) str += ': ' + error.response.data.error;
  }
  log(LogLevel.Error, str);
};

export const logDebug = (msg: string): void => {
  log(LogLevel.Debug, msg);
};
