export const boolean = (str: string): boolean => !!str && str != 'false' && str != 'no' && str != 'off' && str != '0';

export const JSONMessage = (str: string): string =>
  str
    .split(/[\r\n]+/g)
    .map((line) => {
      const result = JSON.parse(`"${line}"`);
      if (typeof result !== 'string') throw new Error('Invalid syntax in .env file');

      return result;
    })
    .join('\n');

export const env = (str: string): string =>
  typeof str === 'string' ? JSONMessage(str).replace(/<date>/gi, new Date().toUTCString()) : '';
