import { isPrivateAddress } from './index';

/** The shape of Node's `os.networkInterfaces()`, so a test can pass a fixed list. */
export type NetworkInterfaces = Record<
  string,
  ReadonlyArray<{ address: string; family: string | number; internal: boolean }> | undefined
>;

/**
 * Where a phone on this network can open the Producer page: this computer's private IPv4
 * addresses (the API only answers private addresses). Falls back to this computer alone.
 */
export function producerUrls(interfaces: NetworkInterfaces, port: number): string[] {
  const urls: string[] = [];
  for (const list of Object.values(interfaces)) {
    for (const i of list ?? []) {
      const v4 = i.family === 'IPv4' || i.family === 4;
      if (v4 && !i.internal && isPrivateAddress(i.address)) {
        urls.push(`http://${i.address}:${port}/`);
      }
    }
  }
  return urls.length > 0 ? urls : [`http://127.0.0.1:${port}/`];
}
