import { describe, expect, it } from 'vitest'
import {
  addressBreakdown,
  bitsToValue,
  describePrefix,
  octetBits,
  OCTET_WEIGHTS,
  smallestPrefixForHosts,
  splitNetwork,
  toBinary,
} from './subnetMath'

describe('describePrefix', () => {
  it('gives the standard /24 numbers', () => {
    const f = describePrefix(24)
    expect(f.mask).toBe('255.255.255.0')
    expect(f.networkBits).toBe(24)
    expect(f.hostBits).toBe(8)
    expect(f.totalAddresses).toBe(256)
    expect(f.usableHosts).toBe(254)
    expect(f.maskBinary).toBe('11111111.11111111.11111111.00000000')
  })

  it.each([
    [8, 16_777_216, 16_777_214],
    [16, 65_536, 65_534],
    [25, 128, 126],
    [26, 64, 62],
    [27, 32, 30],
    [28, 16, 14],
    [29, 8, 6],
    [30, 4, 2],
  ])('prefix /%i -> %i total, %i usable', (prefix, total, usable) => {
    const f = describePrefix(prefix)
    expect(f.totalAddresses).toBe(total)
    expect(f.usableHosts).toBe(usable)
  })

  it('treats /31 as a point-to-point special case (2 usable, has a note)', () => {
    const f = describePrefix(31)
    expect(f.totalAddresses).toBe(2)
    expect(f.usableHosts).toBe(2)
    expect(f.note).toMatch(/RFC 3021|point-to-point/i)
  })

  it('treats /32 as a host route (1 usable, has a note)', () => {
    const f = describePrefix(32)
    expect(f.totalAddresses).toBe(1)
    expect(f.usableHosts).toBe(1)
    expect(f.note).toMatch(/host route|single host/i)
  })

  it('rejects out-of-range prefixes', () => {
    expect(() => describePrefix(-1)).toThrow()
    expect(() => describePrefix(33)).toThrow()
  })
})

describe('octet bit maths', () => {
  it('decomposes 192 into 128 + 64', () => {
    const bits = octetBits(192)
    const on = OCTET_WEIGHTS.filter((_, i) => bits[i].on)
    expect(on).toEqual([128, 64])
    expect(bitsToValue(bits)).toBe(192)
  })

  it('round-trips every value 0..255', () => {
    for (const v of [0, 1, 42, 128, 200, 254, 255]) {
      expect(bitsToValue(octetBits(v))).toBe(v)
    }
  })

  it('renders binary strings padded to width', () => {
    expect(toBinary(192)).toBe('11000000')
    expect(toBinary(0)).toBe('00000000')
    expect(toBinary(255)).toBe('11111111')
  })
})

describe('addressBreakdown', () => {
  it('finds the landmarks for 192.168.10.42/24', () => {
    const b = addressBreakdown('192.168.10.42', 24)
    expect(b.network).toBe('192.168.10.0')
    expect(b.broadcast).toBe('192.168.10.255')
    expect(b.firstHost).toBe('192.168.10.1')
    expect(b.lastHost).toBe('192.168.10.254')
    expect(b.mask).toBe('255.255.255.0')
  })

  it('works for a /26 block boundary', () => {
    const b = addressBreakdown('192.168.1.130', 26)
    expect(b.network).toBe('192.168.1.128')
    expect(b.broadcast).toBe('192.168.1.191')
    expect(b.firstHost).toBe('192.168.1.129')
    expect(b.lastHost).toBe('192.168.1.190')
  })

  it('handles /31 as both ends usable', () => {
    const b = addressBreakdown('10.0.0.0', 31)
    expect(b.firstHost).toBe('10.0.0.0')
    expect(b.lastHost).toBe('10.0.0.1')
    expect(b.usableHosts).toBe(2)
  })

  it('handles /32 as a single address', () => {
    const b = addressBreakdown('10.0.0.5', 32)
    expect(b.network).toBe('10.0.0.5')
    expect(b.broadcast).toBe('10.0.0.5')
    expect(b.firstHost).toBe('10.0.0.5')
    expect(b.lastHost).toBe('10.0.0.5')
  })
})

describe('splitNetwork', () => {
  it('splits a /24 into four aligned /26s', () => {
    const blocks = splitNetwork('192.168.1.0/24', 26)
    expect(blocks.map((b) => b.cidr)).toEqual([
      '192.168.1.0/26',
      '192.168.1.64/26',
      '192.168.1.128/26',
      '192.168.1.192/26',
    ])
    expect(blocks[0].usableHosts).toBe(62)
  })

  it('splits a /24 into two /25s', () => {
    const blocks = splitNetwork('192.168.1.0/24', 25)
    expect(blocks.map((b) => b.network)).toEqual(['192.168.1.0', '192.168.1.128'])
  })

  it('refuses to "split" into a shorter prefix', () => {
    expect(() => splitNetwork('192.168.1.0/24', 23)).toThrow()
  })
})

describe('smallestPrefixForHosts', () => {
  it.each([
    [3, 29],
    [6, 29],
    [10, 28],
    [25, 27],
    [50, 26],
    [126, 25],
    [254, 24],
  ])('%i hosts -> /%i (normal range)', (hosts, prefix) => {
    expect(smallestPrefixForHosts(hosts)).toBe(prefix)
  })

  it('uses the /31 and /32 special cases for 2 and 1 host', () => {
    // describePrefix credits /31 with 2 usable (RFC 3021) and /32 with 1.
    expect(smallestPrefixForHosts(1)).toBe(32)
    expect(smallestPrefixForHosts(2)).toBe(31)
  })
})
