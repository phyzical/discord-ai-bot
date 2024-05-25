import { Server } from '../types/Server.js';
import { logDebug, logError } from './Log.js';
import axios from 'axios';

export const post = async (
  servers: Server[],
  randomServer: boolean,
  path: string,
  data: object
): Promise<string | object | null> => {
  while (servers.filter((server) => server.available).length == 0)
    // wait until a server is available
    await new Promise((res) => setTimeout(res, 1000));

  let error = null;
  // eslint-disable-next-line newline-per-chained-call
  let order = new Array(servers.length).fill('').map((_, i) => i);
  if (randomServer) order = order.shuffle();
  for (const j in order) {
    const i = order[j];
    // try one until it succeeds
    try {
      // make a request to ollama
      if (!servers[i].available) continue;
      const url = new URL(servers[i].url); // don't modify the original URL

      servers[i].available = false;

      if (path.startsWith('/')) path = path.substring(1);
      if (!url.pathname.endsWith('/')) url.pathname += '/'; // safety
      url.pathname += path;
      logDebug(`Making request to ${url}`);
      const result = await axios.post(url.toString(), data, {
        responseType: 'text',
      });
      servers[i].available = true;

      return result.data;
    } catch (err) {
      servers[i].available = true;
      error = err;
      logError(error);
    }
  }
  if (!error) throw new Error('No servers available');

  throw error;
};
