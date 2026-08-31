/**
 * Headless verification for the Issue Workspace logic: drives the REAL stores
 * with "The Wrong Gateway", then checks evidence, failure point, hypothesis
 * feedback, fix application, and verification against the live simulator.
 */
import { gatewayFailureLab } from '../src/data/labs/gatewayFailure'
import { routingFailureLab } from '../src/data/labs/routingFailure'
import { useNetworkStore } from '../src/store/networkStore'
import { runConnectivityMatrix } from '../src/assistant/tools'
import { executeChange } from '../src/assistant/engine.core'
import { scanLab } from '../src/assistant/diagnose'
import {
  buildFailurePoint,
  buildVerificationTests,
  evaluateHypothesis,
  gatherEvidence,
  progressiveHint,
  HYPOTHESIS_CATEGORIES,
} from '../src/components/issues/issueWorkspace'

// ---- Node shims for browser-only APIs ------------------------------------
const storage = new Map<string, string>()
;(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k),
}
;(globalThis as any).window = globalThis

let failed = false
function check(name: string, cond: boolean, extra?: string) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
  if (!cond) failed = true
}
const net = () => useNetworkStore.getState()

async function main() {
  net().loadLab(gatewayFailureLab)

  // Live analysis the workspace derives on render
  const { devices, links, simulator, issues } = net()
  const matrix = runConnectivityMatrix()
  const failing = matrix.find((t) => !t.success)
  check('connectivity matrix has failures', Boolean(failing), failing ? `${failing.source} → ${failing.destination}` : 'none')

  const primary = devices.find((d) => d.hostname === failing?.source)
  check('primary device identified', primary?.hostname === 'PC-02', primary?.hostname)

  // Evidence — must show the gateway mismatch WITHOUT prescribing the fix
  const evidence = gatherEvidence(primary!, devices, links)
  const gwRow = evidence.rows.find((r) => r.label === 'Default Gateway')?.value
  const routerRow = evidence.rows.find((r) => r.label === 'Connected Router Interface')?.value
  check('evidence shows configured gateway 10.1.10.254', gwRow === '10.1.10.254', gwRow)
  check('evidence shows on-link router 10.1.10.1', routerRow === '10.1.10.1', routerRow)
  check('evidence raises a gateway warning', evidence.notes.some((n) => n.tone === 'warn' && n.categories.includes('gateway')))

  // Failure point — trace must break at PC-02 (invalid gateway)
  const fp = buildFailurePoint(issues, devices, (s, d) => simulator.traceRoute(s, d), failing)
  check('failure point exists and stops at source', fp !== null && fp.hops[0].device === 'PC-02' && fp.failedHopIndex === 0, fp?.reason)

  // Hypothesis — gateway is correct direction; others get educational nudges
  const gwFeedback = evaluateHypothesis('gateway', evidence)
  check('gateway hypothesis: correct direction', gwFeedback.correctDirection)
  const dnsFeedback = evaluateHypothesis('dns', evidence)
  check('dns hypothesis: educational nudge, not "wrong"', !dnsFeedback.correctDirection && dnsFeedback.text.length > 40)
  check('all 9 hypothesis categories present', HYPOTHESIS_CATEGORIES.length === 9)

  // Progressive hints — 3 levels, each stronger
  const h0 = progressiveHint(evidence, 0)
  const h2 = progressiveHint(evidence, 2)
  check('hint level 0 is generic', h0.length > 30 && !h0.includes('10.1.10.254'))
  check('hint level 2 names the mismatch', h2.includes('10.1.10.254') && h2.includes('10.1.10.1'))

  // Suggested fix comes from the live diagnose engine, then really applies
  const fix = scanLab().plan[0]
  check('scanLab proposes a gateway fix on PC-02', fix?.kind === 'gateway' && fix?.deviceRef === 'PC-02', fix?.summary)
  const outcome = executeChange(fix!)
  check('executeChange applied the fix', outcome.ok, outcome.report)

  // Verification — REAL tests only
  const tests = buildVerificationTests(net().devices.find((d) => d.hostname === 'PC-02'), net().devices)
  check('verification includes gateway + remote network tests', tests.length >= 2, `${tests.length} tests`)
  const allOk = tests.every((t) => {
    const r = net().simulator.ping(t.source, t.destinationIp)
    return r.success
  })
  check('all verification tests pass after fix', allOk)
  const matrixAfter = runConnectivityMatrix()
  check('full connectivity matrix green after fix', matrixAfter.every((t) => t.success), `${matrixAfter.filter((t) => t.success).length}/${matrixAfter.length}`)

  // Generic across labs: routing fault produces routing evidence/fix, not gateway
  net().loadLab(routingFailureLab)
  const matrix2 = runConnectivityMatrix()
  const failing2 = matrix2.find((t) => !t.success)
  const primary2 = net().devices.find((d) => d.hostname === failing2?.source)
  const evidence2 = gatherEvidence(primary2!, net().devices, net().links)
  const fp2 = buildFailurePoint(net().issues, net().devices, (s, d) => net().simulator.traceRoute(s, d), failing2)
  check('routing lab: failure point identified', fp2 !== null, fp2?.reason)
  check('routing lab: fix is not a gateway change', scanLab().plan[0]?.kind !== 'gateway', scanLab().plan[0]?.summary)

  console.log(failed ? '\n❌ VERIFICATION FAILED' : '\n✅ ALL CHECKS PASSED')
  process.exit(failed ? 1 : 0)
}

void main()