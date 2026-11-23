import { describe, expect, it } from 'vitest';
import { producerUrls, type NetworkInterfaces } from './addresses';

const iface = (address: string, family: 'IPv4' | 'IPv6', internal = false) => ({
  address,
  family,
  internal,
});

describe('producerUrls', () => {
  it('lists the private IPv4 addresses of this computer with the port', () => {
    const interfaces: NetworkInterfaces = {
      lo0: [iface('127.0.0.1', 'IPv4', true)],
      en0: [iface('fe80::1', 'IPv6'), iface('192.168.1.20', 'IPv4')],
      utun0: [iface('10.8.0.2', 'IPv4')],
      en5: [iface('8.8.4.4', 'IPv4')],
    };
    expect(producerUrls(interfaces, 4780)).toEqual([
      'http://192.168.1.20:4780/',
      'http://10.8.0.2:4780/',
    ]);
  });

  it('falls back to this computer alone when it has no network address', () => {
    expect(producerUrls({}, 5000)).toEqual(['http://127.0.0.1:5000/']);
  });
});
