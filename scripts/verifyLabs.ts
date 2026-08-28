import { gatewayFailureLab } from '../src/data/labs/gatewayFailure'
import { interfaceFailureLab } from '../src/data/labs/interfaceFailure'
import { routingFailureLab } from '../src/data/labs/routingFailure'
import { starterLab } from '../src/data/labs/starterLab'
import { NetworkSimulator } from '../src/network/simulator'
import { applyFailures } from '../src/network/failures'
import type { LabDefinition } from '../src/data/labs/starterLab'

let failed = false
function check(name: string, cond: boolean, extra?: string) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failed = true
}

// Baseline sanity: healthy network gets end-to-end.
const baseSim = new NetworkSimulator(starterLab.devices, starterLab.links)
const basePing = baseSim.ping('PC-01', '10.1.20.10')
check('baseline PC-01 -> SRV-01 succeeds', basePing.success, basePing.failureReason)

const labs: LabDefinition[] = [gatewayFailureLab, interfaceFailureLab, routingFailureLab]

for (const lab of labs) {
  console.log(`\n=== ${lab.title} ===`)
  const broken = applyFailures(lab.devices, lab.links, lab.failures ?? [])
  const sim = new NetworkSimulator(broken.devices, broken.links)

  if (lab.id === 'wrong-gateway') {
    const cross = sim.ping('PC-02', '10.1.20.10')
    check('PC-02 -> SRV-01 fails', !cross.success, cross.failureReason)
    check('failure is ARP-based gateway miss', (cross.failureReason ?? '').includes('ARP'))
    const local = sim.ping('PC-02', '10.1.10.10')
    check('PC-02 -> PC-01 still works (same subnet)', local.success, local.failureReason)
    const other = sim.ping('PC-01', '10.1.20.10')
    check('PC-01 -> SRV-01 unaffected', other.success)
  }

  if (lab.id === 'interface-down') {
    const r02 = broken.devices.find((d) => d.id === 'r-02')
    const iface = r02?.interfaces.find((i) => i.id === 'r-02-gi1')
    check('r-02 Gi0/1 is down', iface?.status === 'down')
    check('link l6 reflects down state', broken.links.find((l) => l.id === 'l6')?.status === 'down')
    const ping = sim.ping('PC-01', '10.1.20.10')
    check('PC-01 -> SRV-01 fails', !ping.success, ping.failureReason)
    check('dies on egress interface', (ping.failureReason ?? '').includes('Egress interface down'))
  }

  if (lab.id === 'missing-route') {
    const r02 = broken.devices.find((d) => d.id === 'r-02')
    check('R-02 lost its 10.1.20.0 route', r02?.staticRoutes?.length === 1)
    const ping = sim.ping('PC-01', '10.1.20.10')
    check('PC-01 -> SRV-01 fails', !ping.success, ping.failureReason)
    check('dies with no route at R-02', (ping.failureReason ?? '').includes('No route'))
  }
}

console.log(failed ? '\nRESULT: FAILURES PRESENT' : '\nRESULT: ALL CHECKS PASSED')
process.exitCode = failed ? 1 : 0