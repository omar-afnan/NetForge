import { getDevices, getSelectedDevice } from './context'

export type AssistantIntent =
  | 'greet'
  | 'help'
  | 'configure'
  | 'gateway'
  | 'route-add'
  | 'route-remove'
  | 'interface-status'
  | 'ping'
  | 'diagnose'
  | 'find-problems'
  | 'complete-lab'
  | 'topology'
  | 'device-info'
  | 'concept'
  | 'tests'
  | 'unknown'

export interface ParsedRoute {
  destination: string
  mask?: string
  prefix?: number
  nextHop: string
}

export interface ParsedCommand {
  intent: AssistantIntent
  raw: string
  deviceRef?: string
  targetRef?: string
  ip?: string
  mask?: string
  prefix?: number
  gateway?: string
  route?: ParsedRoute
  interfaceRef?: string
  status?: 'up' | 'down'
  concept?: string
}

const IP_PATTERN = /\b(\d{1,3}(?:\.\d{1,3}){3})\b/g
const CIDR_PATTERN = /\b(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})\b/
const MASK_PATTERN = /\b(?:mask|netmask|subnet mask)\s*:?\s*(\d{1,3}(?:\.\d{1,3}){3})\b/i
const INTERFACE_PATTERN = /\b(?:interface\s+)?((?:eth|fa|gi|mgmt|serial|se)[0-9/]{0,4})\b/i
const ORDINAL_PATTERN = /\b(pc|computer|switch|router|server)s?\s*#?\s*(\d{1,2})\b/i

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isValidMask(mask: string): boolean {
  const parts = mask.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false
  const bits = parts.map((part) => part.toString(2).padStart(8, '0')).join('')
  return /^1*0*$/.test(bits)
}

/** Find device mentions in free text: hostnames, "this device", or "router 1" style ordinals. */
function findDeviceMentions(text: string): string[] {
  const devices = getDevices()
  const refs: string[] = []
  const working = text.toLowerCase()

  for (const device of devices) {
    const pattern = new RegExp(`\\b${escapeRegex(device.hostname.toLowerCase())}\\b`, 'i')
    if (pattern.test(working) && !refs.includes(device.hostname)) {
      refs.push(device.hostname)
    }
  }

  if (refs.length === 0 && /\b(this|the selected|current|selected)\b/.test(working)) {
    const selected = getSelectedDevice()
    if (selected) refs.push(selected.hostname)
  }

  if (refs.length === 0) {
    const ordinal = ORDINAL_PATTERN.exec(working)
    if (ordinal) {
      const kind = ordinal[1]
      const index = Number(ordinal[2])
      const kindPrefix = kind.startsWith('pc') || kind.startsWith('computer') ? 'pc' : kind
      const matches = devices.filter((device) => device.type === kindPrefix)
      const byPosition = matches[index - 1]
      if (byPosition) refs.push(byPosition.hostname)
    }
  }

  return refs
}

function extractIps(text: string): string[] {
  return [...text.matchAll(IP_PATTERN)].map((match) => match[1])
}

function extractMask(text: string, ips: string[]): string | undefined {
  const explicit = MASK_PATTERN.exec(text)
  if (explicit) return explicit[1]
  const dotted = ips.find((ip) => ip.startsWith('255.') && isValidMask(ip))
  if (dotted) return dotted
  return undefined
}

function extractGateway(text: string, ips: string[]): string | undefined {
  const gatewayPattern = /(?:default\s+)?(?:gateway|gw)\D{0,20}?(\d{1,3}(?:\.\d{1,3}){3})/i
  const match = gatewayPattern.exec(text)
  if (match) return match[1]
  if (/\bgateway\b|\bgw\b/i.test(text) && ips.length > 0) return ips[ips.length - 1]
  return undefined
}

function extractRoute(text: string, ips: string[]): ParsedRoute | undefined {
  const cidr = CIDR_PATTERN.exec(text)
  const viaPattern = /\bvia\s+:?\s*(\d{1,3}(?:\.\d{1,3}){3})/i
  const via = viaPattern.exec(text)
  if (!via || ips.length === 0) return undefined

  let destination: string | undefined
  let mask: string | undefined
  let prefix: number | undefined

  if (cidr) {
    destination = cidr[1]
    prefix = Number(cidr[2])
  } else {
    const candidates = ips.filter((ip) => ip !== via[1])
    const dottedMask = candidates.find((ip) => ip.startsWith('255.') && isValidMask(ip))
    destination = candidates.find((ip) => ip !== dottedMask)
    mask = dottedMask
  }

  if (!destination) return undefined
  return { destination, mask, prefix, nextHop: via[1] }
}

function extractInterfaceRef(text: string): string | undefined {
  const match = INTERFACE_PATTERN.exec(text)
  return match?.[1]?.toLowerCase()
}

function extractStatus(text: string): 'up' | 'down' | undefined {
  if (/\b(shut ?down|disable|turn off|bring down|take down|down)\b/i.test(text)) return 'down'
  if (/\b(enable|no shut|no shutdown|turn on|bring up|activate|up)\b/i.test(text)) return 'up'
  return undefined
}

function detectConcept(text: string): string | undefined {
  const concepts: Array<[RegExp, string]> = [
    [/\bdefault gateways?\b|\bgateways?\b/, 'default gateway'],
    [/\bsubnet(ting| mask|s)?\b/, 'subnetting'],
    [/\bcidr\b|\bprefix(es)?\b/, 'cidr'],
    [/\barp\b/, 'arp'],
    [/\bmac (address(es)?|tables?)?\b/, 'mac address'],
    [/\bvlan?s?\b/, 'vlan'],
    [/\bstatic routes?\b|\brouting\b|\bdefault routes?\b/, 'routing'],
    [/\bswitch(es|ing)?\b/, 'switching'],
    [/\brouters?\b/, 'routing'],
    [/\btcp\b/, 'tcp'],
    [/\budp\b/, 'udp'],
    [/\bports?\b/, 'ports'],
    [/\bbroadcast\b/, 'broadcast domain'],
    [/\bnat\b/, 'nat'],
    [/\bpings?\b|\bicmp\b/, 'ping'],
    [/\btraceroutes?\b/, 'traceroute'],
    [/\bethernet\b|\bcables?\b/, 'ethernet'],
    [/\bip addresses?\b|\bipv4\b/, 'ip address'],
    [/\bdhcp\b/, 'dhcp'],
  ]
  for (const [pattern, concept] of concepts) {
    if (pattern.test(text)) return concept
  }
  return undefined
}

export function parseCommand(raw: string): ParsedCommand {
  const text = raw.trim()
  const lower = text.toLowerCase()
  const ips = extractIps(text)
  const mentions = findDeviceMentions(text)
  const deviceRef = mentions[0]
  const targetRef = mentions[1]
  const mask = extractMask(text, ips)
  const gateway = extractGateway(text, ips)
  const cidr = CIDR_PATTERN.exec(text)
  const mainIp = ips.find((ip) => ip !== mask && ip !== gateway)
  const interfaceRef = extractInterfaceRef(text)
  const status = extractStatus(text)
  const concept = detectConcept(lower)

  const base: ParsedCommand = { intent: 'unknown', raw: text }

  // 1. Greetings & help (short messages only, so "hi, why can't PC-01 ping" still routes).
  if (text.length <= 24 && /^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b/.test(lower)) {
    return { ...base, intent: 'greet' }
  }
  if (/\bhelp\b|what can you (do|help)|your capabilities|how do you work/.test(lower)) {
    return { ...base, intent: 'help' }
  }

  // 2. Lab completion / takeover.
  if (
    /\b(complete|finish|solve|do)\s+(this|the|my|it)?\s*lab\b/.test(lower) ||
    /\b(complete|finish|solve|do)\s+(it|this)\s+for me\b/.test(lower) ||
    /\btake over\b|\bfix everything\b|\bfix all\b/.test(lower)
  ) {
    return { ...base, intent: 'complete-lab', deviceRef, targetRef }
  }

  // 3. Connectivity test suite.
  if (/\brun\b.*\btests?\b|\btest connectivity\b|\bverify\b|\bcheck (all|connectivity|everything)\b/.test(lower)) {
    return { ...base, intent: 'tests', deviceRef, targetRef }
  }

  // 4. Explicit ping requests.
  if (/\bping\b/.test(lower) && !/^why\b/.test(lower)) {
    return { ...base, intent: 'ping', deviceRef, targetRef }
  }

  // 5. Diagnosis ("why can't A ping B", "why is this not forwarding", "troubleshoot X").
  if (
    /^why\b/.test(lower) ||
    /\b(troubleshoot|debug|diagnose)\b/.test(lower) ||
    /\b(not working|failing|broken|no connectivity)\b/.test(lower)
  ) {
    return { ...base, intent: 'diagnose', deviceRef, targetRef }
  }

  // 6. Broad problem search.
  if (
    /\bwhat('?s| is) wrong\b/.test(lower) ||
    /\bfind\b.*\b(problem|issue|fault|error)s?\b/.test(lower) ||
    /\bwhat am i doing wrong\b/.test(lower) ||
    /\bany (problems|issues)\b/.test(lower) ||
    /\bproblems? with (my|the) (topology|network|lab)\b/.test(lower)
  ) {
    return { ...base, intent: 'find-problems', deviceRef, targetRef }
  }

  // 7. Concept explanations (after diagnostics so "why…" wins).
  if (
    /\b(explain|teach me|define)\b/.test(lower) ||
    /^(what (is|are)|what'?s)\b/.test(lower) ||
    /^(how (do|does|to|can))\b/.test(lower) ||
    /\bdifference between\b/.test(lower)
  ) {
    return { ...base, intent: 'concept', concept }
  }

  // 8. Static route removal.
  if (/\b(remove|delete|undo|no)\b.*\b(route|route entry)\b|\bno ip route\b/.test(lower)) {
    const route = extractRoute(text, ips)
    return { ...base, intent: 'route-remove', deviceRef, route }
  }

  // 9. Static route addition.
  if (/\b(add|create|insert|set)\b.*\broutes?\b|\bstatic route\b|\bip route\b/.test(lower)) {
    const route = extractRoute(text, ips)
    return { ...base, intent: 'route-add', deviceRef, route }
  }

  // 10. Default gateway configuration.
  if (/\b(gateway|gw)\b/.test(lower) && gateway) {
    return { ...base, intent: 'gateway', deviceRef, gateway }
  }

  // 11. Interface up/down.
  if (interfaceRef && status && /\b(shut|enable|disable|turn|bring|set|interface|link)\b/.test(lower)) {
    return { ...base, intent: 'interface-status', deviceRef, interfaceRef, status }
  }

  // 12. Interface/IP configuration.
  if (
    /\b(configure|config|setup|set|assign|change|give|update|apply)\b/.test(lower) &&
    (mainIp || cidr || mask)
  ) {
    return {
      ...base,
      intent: 'configure',
      deviceRef,
      interfaceRef,
      ip: mainIp,
      mask,
      prefix: cidr ? Number(cidr[2]) : undefined,
      gateway,
    }
  }
  if (
    /\b(configure|config|setup|set|assign|change|update)\b/.test(lower) &&
    /\b(ip|address|interface)\b/.test(lower)
  ) {
    return { ...base, intent: 'configure', deviceRef, interfaceRef }
  }

  // 13. Device inspection.
  if (deviceRef && /\b(show|info|information|details|inspect|about|status|report|summar)\b/.test(lower)) {
    return { ...base, intent: 'device-info', deviceRef }
  }

  // 14. Topology overview.
  if (/\b(topology|overview|what devices|list devices|device list|network layout)\b/.test(lower)) {
    return { ...base, intent: 'topology' }
  }

  // 15. Lab info.
  if (/\b(this|the|current)\s+lab\b/.test(lower)) {
    return { ...base, intent: 'topology' }
  }

  return { ...base, intent: 'unknown', deviceRef, targetRef }
}


