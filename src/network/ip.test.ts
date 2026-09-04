import { describe, expect, it } from 'vitest'
import {
  cidrToMask,
  formatNetwork,
  getNetworkAddress,
  intToIp,
  ipToInt,
  isSameSubnet,
  isValidIpv4,
  maskToPrefix,
  prefixToMask,
} from './ip'

describe('ipToInt / intToIp', () => {
  it('round-trips common addresses', () => {
    for (const ip of ['0.0.0.0', '10.0.0.1', '192.168.1.10', '255.255.255.255', '172.16.254.1']) {
      expect(intToIp(ipToInt(ip))).toBe(ip)
    }
  })

  it('produces the expected 32-bit value', () => {
    expect(ipToInt('255.255.255.0')).toBe(0xffffff00)
    expect(ipToInt('0.0.0.1')).toBe(1)
  })

  it('rejects malformed addresses', () => {
    for (const bad of ['', '1.2.3', '1.2.3.4.5', '256.0.0.1', 'a.b.c.d', '1.2.3.-1']) {
      expect(() => ipToInt(bad)).toThrow()
    }
  })
})

describe('prefixToMask / maskToPrefix', () => {
  it.each([
    [0, '0.0.0.0'],
    [8, '255.0.0.0'],
    [16, '255.255.0.0'],
    [24, '255.255.255.0'],
    [26, '255.255.255.192'],
    [30, '255.255.255.252'],
    [32, '255.255.255.255'],
  ])('/%i <-> %s', (prefix, mask) => {
    expect(prefixToMask(prefix)).toBe(mask)
    expect(maskToPrefix(mask)).toBe(prefix)
  })

  it('rejects a non-contiguous mask', () => {
    expect(() => maskToPrefix('255.0.255.0')).toThrow()
    expect(() => maskToPrefix('255.255.255.1')).toThrow()
  })

  it('rejects an out-of-range prefix', () => {
    expect(() => prefixToMask(33)).toThrow()
    expect(() => prefixToMask(-1)).toThrow()
  })
})

describe('getNetworkAddress / isSameSubnet', () => {
  it('masks the host bits off', () => {
    expect(getNetworkAddress('192.168.1.130', '255.255.255.0')).toBe('192.168.1.0')
    expect(getNetworkAddress('192.168.1.130', '255.255.255.192')).toBe('192.168.1.128')
    expect(getNetworkAddress('10.1.2.3', '255.0.0.0')).toBe('10.0.0.0')
  })

  it('decides neighbours by the mask', () => {
    expect(isSameSubnet('192.168.1.10', '192.168.1.20', '255.255.255.0')).toBe(true)
    expect(isSameSubnet('192.168.1.10', '192.168.1.130', '255.255.255.192')).toBe(false)
    expect(isSameSubnet('192.168.1.10', '192.168.2.10', '255.255.255.0')).toBe(false)
    expect(isSameSubnet('192.168.1.10', '192.168.2.10', '255.255.0.0')).toBe(true)
  })
})

describe('helpers', () => {
  it('cidrToMask parses a CIDR string', () => {
    expect(cidrToMask('10.0.0.0/24')).toBe('255.255.255.0')
    expect(cidrToMask('10.0.0.0/30')).toBe('255.255.255.252')
  })

  it('formatNetwork returns network/prefix', () => {
    expect(formatNetwork('192.168.1.42', '255.255.255.0')).toBe('192.168.1.0/24')
  })

  it('isValidIpv4 mirrors ipToInt', () => {
    expect(isValidIpv4('192.168.1.1')).toBe(true)
    expect(isValidIpv4('999.1.1.1')).toBe(false)
    expect(isValidIpv4('')).toBe(false)
  })
})
