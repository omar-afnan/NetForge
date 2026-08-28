export function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`)
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

export function intToIp(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.')
}

export function maskToPrefix(mask: string): number {
  const bits = ipToInt(mask)
    .toString(2)
    .padStart(32, '0')
    .split('')
  let prefix = 0
  for (const bit of bits) {
    if (bit === '0') break
    prefix += 1
  }
  if (bits.slice(prefix).some((b) => b === '1')) {
    throw new Error(`Invalid subnet mask: ${mask}`)
  }
  return prefix
}

export function prefixToMask(prefix: number): string {
  if (prefix < 0 || prefix > 32) throw new Error(`Invalid prefix: ${prefix}`)
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  return intToIp(mask)
}

export function getNetworkAddress(ip: string, mask: string): string {
  const ipInt = ipToInt(ip)
  const maskInt = ipToInt(mask)
  return intToIp((ipInt & maskInt) >>> 0)
}

export function isSameSubnet(ip1: string, ip2: string, mask: string): boolean {
  return getNetworkAddress(ip1, mask) === getNetworkAddress(ip2, mask)
}

export function isHostInNetwork(ip: string, network: string, mask: string): boolean {
  return getNetworkAddress(ip, mask) === getNetworkAddress(network, mask)
}

export function cidrToMask(cidr: string): string {
  const [, prefixStr] = cidr.split('/')
  const prefix = Number(prefixStr)
  return prefixToMask(prefix)
}

export function formatNetwork(ip: string, mask: string): string {
  return `${getNetworkAddress(ip, mask)}/${maskToPrefix(mask)}`
}

export function isValidIpv4(ip: string): boolean {
  try {
    ipToInt(ip)
    return true
  } catch {
    return false
  }
}
