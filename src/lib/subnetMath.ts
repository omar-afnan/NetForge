/**
 * subnetMath - the single source of truth for every CIDR/subnet number the
 * interactive lessons display. Both the visual widgets and the prose
 * explanations read from these functions, so an animation can never drift
 * from the value it claims to show.
 *
 * Builds on the primitive IPv4 helpers in src/network/ip.ts.
 */
import { intToIp, ipToInt, prefixToMask } from '@/network/ip'

export interface PrefixFacts {
  prefix: number
  /** Dotted-decimal mask, e.g. "255.255.255.0". */
  mask: string
  /** 32-char binary mask grouped into octets, e.g. "11111111.11111111.11111111.00000000". */
  maskBinary: string
  networkBits: number
  hostBits: number
  /** 2 ** hostBits. */
  totalAddresses: number
  /** Addresses an operator can actually assign to hosts. */
  usableHosts: number
  /**
   * Set for the two prefixes where the "subtract 2" rule does not apply.
   * Undefined for /8../30, where the normal rule holds.
   */
  note?: string
}

const GROUP = (bits: string) => bits.match(/.{1,8}/g)?.join('.') ?? bits

/**
 * Everything a learner needs to know about a single prefix length /8../32.
 * /31 and /32 are handled as the explicit special cases they are, rather
 * than by blindly applying "total - 2".
 */
export function describePrefix(prefix: number): PrefixFacts {
  if (prefix < 0 || prefix > 32) throw new Error(`prefix out of range: ${prefix}`)

  const hostBits = 32 - prefix
  const mask = prefixToMask(prefix)
  const maskBinary = GROUP(ipToInt(mask).toString(2).padStart(32, '0'))
  const totalAddresses = 2 ** hostBits

  if (prefix === 32) {
    return {
      prefix,
      mask,
      maskBinary,
      networkBits: 32,
      hostBits: 0,
      totalAddresses: 1,
      usableHosts: 1,
      note: 'A /32 is a single host - a "host route". There is no network or broadcast address to set aside, so the one address is usable.',
    }
  }

  if (prefix === 31) {
    return {
      prefix,
      mask,
      maskBinary,
      networkBits: 31,
      hostBits: 1,
      totalAddresses: 2,
      usableHosts: 2,
      note: 'A /31 has only 2 addresses. RFC 3021 lets a point-to-point link use BOTH of them - there is no separate network or broadcast address on a link with exactly two ends.',
    }
  }

  const usableHosts = Math.max(0, totalAddresses - 2)
  return {
    prefix,
    mask,
    maskBinary,
    networkBits: prefix,
    hostBits,
    totalAddresses,
    usableHosts,
    note:
      prefix === 30
        ? 'A /30 gives 4 addresses, 2 usable - the classic size for a router-to-router link.'
        : undefined,
  }
}

/** The eight positional weights of one octet, high bit first. */
export const OCTET_WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1] as const

export interface OctetBit {
  weight: number
  on: boolean
}

/** Decompose 0-255 into its eight weighted bits. */
export function octetBits(value: number): OctetBit[] {
  const v = Math.max(0, Math.min(255, Math.round(value)))
  return OCTET_WEIGHTS.map((weight) => ({ weight, on: (v & weight) !== 0 }))
}

/** Sum the weights that are switched on. */
export function bitsToValue(bits: OctetBit[]): number {
  return bits.reduce((sum, b) => (b.on ? sum + b.weight : sum), 0)
}

/** Zero-padded binary string of `value` in `width` bits. */
export function toBinary(value: number, width = 8): string {
  return (value >>> 0).toString(2).padStart(width, '0').slice(-width)
}

export interface AddressBreakdown {
  ip: string
  prefix: number
  mask: string
  network: string
  broadcast: string
  firstHost: string
  lastHost: string
  /** Number of assignable host addresses in this block. */
  usableHosts: number
  note?: string
}

/**
 * Given any host IP and a prefix, work out the network address, broadcast
 * address and the first/last assignable host. /31 and /32 return sensible
 * point-to-point / host-route answers.
 */
export function addressBreakdown(ip: string, prefix: number): AddressBreakdown {
  const facts = describePrefix(prefix)
  const ipInt = ipToInt(ip)
  const maskInt = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const networkInt = (ipInt & maskInt) >>> 0
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0

  if (prefix === 32) {
    return {
      ip,
      prefix,
      mask: facts.mask,
      network: ip,
      broadcast: ip,
      firstHost: ip,
      lastHost: ip,
      usableHosts: 1,
      note: facts.note,
    }
  }

  if (prefix === 31) {
    return {
      ip,
      prefix,
      mask: facts.mask,
      network: intToIp(networkInt),
      broadcast: intToIp(broadcastInt),
      firstHost: intToIp(networkInt),
      lastHost: intToIp(broadcastInt),
      usableHosts: 2,
      note: facts.note,
    }
  }

  return {
    ip,
    prefix,
    mask: facts.mask,
    network: intToIp(networkInt),
    broadcast: intToIp(broadcastInt),
    firstHost: intToIp((networkInt + 1) >>> 0),
    lastHost: intToIp((broadcastInt - 1) >>> 0),
    usableHosts: facts.usableHosts,
    note: facts.note,
  }
}

export interface SubnetBlock {
  /** e.g. "192.168.1.64" */
  network: string
  prefix: number
  /** e.g. "192.168.1.64/26" */
  cidr: string
  firstHost: string
  lastHost: string
  broadcast: string
  /** Total addresses in the block. */
  size: number
  usableHosts: number
}

/**
 * Split `baseCidr` (e.g. "192.168.1.0/24") into equal blocks of length
 * `intoPrefix` (e.g. 26), returned in address order.
 */
export function splitNetwork(baseCidr: string, intoPrefix: number): SubnetBlock[] {
  const [base, basePrefixStr] = baseCidr.split('/')
  const basePrefix = Number(basePrefixStr)
  if (intoPrefix < basePrefix || intoPrefix > 32) {
    throw new Error(`cannot split /${basePrefix} into /${intoPrefix}`)
  }

  const baseInt = ipToInt(base) >>> 0
  const blockSize = 2 ** (32 - intoPrefix)
  const count = 2 ** (intoPrefix - basePrefix)

  return Array.from({ length: count }, (_, i) => {
    const networkInt = (baseInt + i * blockSize) >>> 0
    const b = addressBreakdown(intToIp(networkInt), intoPrefix)
    return {
      network: b.network,
      prefix: intoPrefix,
      cidr: `${b.network}/${intoPrefix}`,
      firstHost: b.firstHost,
      lastHost: b.lastHost,
      broadcast: b.broadcast,
      size: blockSize,
      usableHosts: b.usableHosts,
    }
  })
}

/**
 * The longest prefix (smallest block) that still provides at least `hosts`
 * assignable addresses. Used by the design challenge to hint the right size.
 */
export function smallestPrefixForHosts(hosts: number): number {
  for (let prefix = 32; prefix >= 0; prefix -= 1) {
    if (describePrefix(prefix).usableHosts >= hosts) return prefix
  }
  return 0
}

/** "192.168.1.0" + 24 -> "192.168.1.0/24". */
export function toCidr(network: string, prefix: number): string {
  return `${network}/${prefix}`
}
