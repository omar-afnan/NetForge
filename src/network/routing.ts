import type { Device, Route } from './types'
import { formatNetwork, getNetworkAddress, ipToInt } from './ip'

function routeMetric(destination: string, mask: string): number {
  const destInt = ipToInt(getNetworkAddress(destination, mask))
  const maskInt = ipToInt(mask)
  return maskInt + destInt
}

export function getRoutingTable(device: Device): Route[] {
  const routes: Route[] = []

  for (const iface of device.interfaces) {
    if (!iface.ipAddress || !iface.subnetMask) continue
    routes.push({
      destination: getNetworkAddress(iface.ipAddress, iface.subnetMask),
      mask: iface.subnetMask,
      interfaceId: iface.id,
      interfaceName: iface.name,
      type: 'connected',
      status: iface.status === 'up' ? 'active' : 'inactive',
    })
  }

  for (const route of device.staticRoutes ?? []) {
    const iface = route.interfaceId
      ? device.interfaces.find((item) => item.id === route.interfaceId)
      : undefined

    routes.push({
      destination: getNetworkAddress(route.destination, route.mask),
      mask: route.mask,
      nextHop: route.nextHop,
      interfaceId: iface?.id ?? '',
      interfaceName: iface?.name ?? '*',
      type: 'static',
      status: 'active',
    })
  }

  return routes.sort((a, b) => routeMetric(b.destination, b.mask) - routeMetric(a.destination, a.mask))
}

export function findBestRoute(device: Device, destinationIp: string): Route | undefined {
  const routes = getRoutingTable(device).filter((route) => route.status === 'active')
  let best: Route | undefined

  for (const route of routes) {
    const network = getNetworkAddress(destinationIp, route.mask)
    const routeNetwork = getNetworkAddress(route.destination, route.mask)
    if (network !== routeNetwork) continue
    if (!best || ipToInt(route.mask) > ipToInt(best.mask)) {
      best = route
    }
  }

  return best
}

export function describeRoute(route: Route): string {
  const network = formatNetwork(route.destination, route.mask)
  if (route.type === 'connected') {
    return `${network} directly connected, ${route.interfaceName}`
  }
  return `${network} via ${route.nextHop ?? 'unknown'}, ${route.interfaceName}`
}
