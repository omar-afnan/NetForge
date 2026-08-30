/**
 * Headless lifecycle verification: drives the REAL stores and the REAL AI
 * takeover driver for "The Wrong Gateway" (and lab switching), without a
 * browser.
 */
import { gatewayFailureLab } from '../src/data/labs/gatewayFailure'
import { interfaceFailureLab } from '../src/data/labs/interfaceFailure'
import { routingFailureLab } from '../src/data/labs/routingFailure'
import { useNetworkStore } from '../src/store/networkStore'
import { useCopilotStore } from '../src/store/copilotStore'
import { scanLab } from '../src/assistant/diagnose'
import { executeChange } from '../src/assistant/engine.core'
import { runConnectivityMatrix } from '../src/assistant/tools'
import { runLabAssist } from '../src/assistant/labAssist'

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
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` � ${extra}` : ''}`)
  if (!cond) failed = true
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const copilot = () => useCopilotStore.getState()
const net = () => useNetworkStore.getState()

async function main() {
  // 1. Fresh application state -> open Wrong Gateway
  net().loadLab(gatewayFailureLab)
  check('open: fresh AI chat (greeting only)', copilot().messages.length === 1)
  check('open: takeover IDLE, no feed/summary/plan', copilot().labAssist.phase === 'idle' && copilot().labAssist.feed.length === 0 && copilot().labAssist.summary === null && copilot().pendingPlan === null)

  // 2. Start lab -- fault is the wrong gateway on PC-02
  const pc02 = net().devices.find((d) => d.hostname === 'PC-02')!
  check('fault injected: PC-02 gateway is 10.1.10.254', pc02.defaultGateway === '10.1.10.254', pc02.defaultGateway)
  const before = runConnectivityMatrix()
  check('before fix: some tests fail', before.some((t) => !t.success), `${before.filter((t) => !t.success).length}/${before.length} failing`)

  // 3. AI inspects + proposes the gateway fix
  const { plan } = scanLab()
  const gwFix = plan.find((c) => c.kind === 'gateway' && c.deviceRef === 'PC-02')
  check('diagnosis: proposes PC-02 gateway fix', !!gwFix, gwFix?.summary)
  check('diagnosis: correct gateway 10.1.10.1', (gwFix?.payload as any)?.gateway === '10.1.10.1')

  // 4. Apply fix, then verify
  for (const change of plan) executeChange(change)
  const after = runConnectivityMatrix()
  check('after fix: ALL tests pass', after.every((t) => t.success), `${after.filter((t) => t.success).length}/${after.length}`)

  // 5. Completion only now (and it persists)
  net().completeLab('wrong-gateway', true)
  const persisted = JSON.parse(storage.get('netforge-lab-progress') ?? '{}')
  check('completion persisted to localStorage', persisted['wrong-gateway']?.completed === true)

  // 6. Completion survives reopening the lab (fresh chat, fault re-injected, badge stays)
  net().loadLab(gatewayFailureLab)
  check('reopen: completion state preserved', net().completedLabs['wrong-gateway']?.completed === true)
  check('reopen: fresh AI chat', copilot().messages.length === 1)
  check('reopen: fault re-injected (fresh lab state)', net().devices.find((d) => d.hostname === 'PC-02')!.defaultGateway === '10.1.10.254')

  // 7. Switch to another lab -- nothing leaks
  copilot().pushTakeoverLine('stale line', 'info')
  net().loadLab(interfaceFailureLab)
  check('switch: messages EMPTY (greeting only)', copilot().messages.length === 1)
  check('switch: AI state IDLE, feed EMPTY', copilot().labAssist.phase === 'idle' && copilot().labAssist.feed.length === 0)
  check('switch: no pending plan, no summary', copilot().pendingPlan === null && copilot().labAssist.summary === null)
  check('switch: completion states correct per lab', net().completedLabs['wrong-gateway']?.completed === true && !net().completedLabs['interface-down'])

  // 8. Race: user switches labs while the AI takeover is mid-flight
  net().loadLab(gatewayFailureLab)
  const runPromise = runLabAssist('wrong-gateway') // started, is working
  await sleep(150) // let it enter the first pause
  net().loadLab(routingFailureLab) // user bails to another lab mid-takeover
  await runPromise.catch(() => {})
  await sleep(1500) // give any stale timers a chance to misbehave
  check('race: takeover stopped cleanly', copilot().labAssist.phase === 'idle' && !copilot().labAssist.busy)
  check('race: new lab not completed by stale run', !net().completedLabs['missing-route'])
  check('race: new lab chat uncontaminated', copilot().messages.length === 1)
  check('race: no stale feed lines on new lab', copilot().labAssist.feed.length === 0)

  // 9. Full AI takeover on Wrong Gateway completes it via verification
  net().loadLab(gatewayFailureLab)
  const auto = runLabAssist('wrong-gateway')
  await sleep(1000)
  check('takeover: overlay visible while working', copilot().labAssist.phase === 'working' && copilot().labAssist.feed.length > 0)
  await auto
  await sleep(100)
  check('takeover: lab completed only after verification', net().completedLabs['wrong-gateway']?.completed === true)
  check('takeover: network actually fixed', runConnectivityMatrix().every((t) => t.success))
  check('takeover: visible feed produced', copilot().labAssist.feed.length > 0)
  check('takeover: feed mentions the gateway fix', copilot().labAssist.feed.some((l) => /gateway/i.test(l.text)))
  check('takeover: real pings executed (packet log populated)', net().packets.length > 0)
  check('takeover: feed shows OLD → NEW gateway narration', copilot().labAssist.feed.some((l) => /10\.1\.10\.254 → 10\.1\.10\.1/.test(l.text)))

  // 10. Final state: reopen -> still completed, fresh chat
  net().loadLab(gatewayFailureLab)
  check('final: completion persists across reopen', net().completedLabs['wrong-gateway']?.completed === true)
  check('final: fresh AI chat', copilot().messages.length === 1)

  // 11. Switching BEFORE completing: no completion, no leaks, round-trip
  net().loadLab(interfaceFailureLab)
  copilot().pushMessage({ id: 'u1', role: 'user', kind: 'text', text: 'why is it broken?' })
  copilot().setPendingPlan({ id: 'p1', title: 't', rationale: [], changes: [] })
  copilot().setTakeoverPhase('working')
  copilot().pushTakeoverLine('stale feed line', 'info')
  net().logPacket({ sourceId: 'pc-01', source: 'PC-01', destination: '10.1.20.10', protocol: 'icmp', summary: 'echo', detail: '' } as any)
  check('pre-complete: source lab has activity, not completed', copilot().messages.length === 2 && !net().completedLabs['interface-down'])
  net().loadLab(routingFailureLab)
  check('pre-complete: target chat fresh', copilot().messages.length === 1)
  check('pre-complete: target has no feed/phase/plan', copilot().labAssist.phase === 'idle' && copilot().labAssist.feed.length === 0 && copilot().pendingPlan === null)
  check('pre-complete: packet log cleared on switch', net().packets.length === 0)
  check('pre-complete: packet trace + selection cleared', net().packetTrace === null && net().selectedDeviceId === null)
  net().loadLab(interfaceFailureLab)
  check('pre-complete: round-trip back — still not completed, fresh chat', !net().completedLabs['interface-down'] && copilot().messages.length === 1)
  check('pre-complete: wrong-gateway completion survived all switching', net().completedLabs['wrong-gateway']?.completed === true)

  // 12. Race: user opens another lab while the takeover sits in the 'complete'
  // phase (overlay timers pending). The switch must neutralize everything.
  net().loadLab(gatewayFailureLab)
  copilot().setTakeoverPhase('complete')
  copilot().setTakeoverSummary('LAB COMPLETED')
  net().loadLab(routingFailureLab) // user bails during the DONE animation
  check('race2: assist fully reset on switch', copilot().labAssist.phase === 'idle' && copilot().labAssist.summary === null && !copilot().labAssist.busy)
  check('race2: other lab not completed by stale phase', !net().completedLabs['missing-route'])
  check('race2: no stale feed/summary leaks', copilot().labAssist.feed.length === 0)

  console.log(failed ? '\nRESULT: FAILURES PRESENT' : '\nRESULT: ALL CHECKS PASSED')
  process.exitCode = failed ? 1 : 0
}

main()
