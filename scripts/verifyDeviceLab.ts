/* Headless smoke test for the Device Lab CLI engine and lesson checks. */
;(globalThis as { window?: unknown }).window = globalThis

import { createRouterDevice, createSwitchDevice, createEndpoint, executeCommand } from '@/devicelab/cli'
import { findLesson, COURSES, allLessons } from '@/devicelab/lessons'
import type { CliDevice } from '@/devicelab/cli'

let failures = 0
function step(name: string, cond: boolean) {
  if (!cond) failures++
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`)
}

const d = createRouterDevice()

// Lesson 1: meet — needs `show ip interface brief`
let found = findLesson('router', 'r-meet')!
step('r-meet fails before command', found.lesson.check(d, {}) !== null)
executeCommand(d, 'show ip interface brief')
step('r-meet passes after show ip int brief', found.lesson.check(d, {}) === null)

// Lesson 2: privileged
found = findLesson('router', 'r-privileged')!
executeCommand(d, 'enable')
step('r-privileged passes after enable', found.lesson.check(d, {}) === null)

// Lesson 3: hostname
found = findLesson('router', 'r-hostname')!
executeCommand(d, 'configure terminal')
executeCommand(d, 'hostname R1-EDGE')
step('r-hostname passes', found.lesson.check(d, {}) === null)
step('prompt reflects hostname', d.hostname === 'R1-EDGE')

// Lesson 4: secret — enable secret beats enable password
executeCommand(d, 'enable secret netforge')
found = findLesson('router', 'r-secret')!
step('r-secret passes', found.lesson.check(d, {}) === null)

// Lesson 7/8: interface IP + no shutdown
executeCommand(d, 'end')
executeCommand(d, 'configure terminal')
const ifaceOut = executeCommand(d, 'interface gigabitEthernet0/0')
step('interface command accepted', !ifaceOut.lines.includes('% Invalid interface type and number'))
console.log('DEBUG mode:', d.mode, 'currentInterface:', d.currentInterface, 'out:', JSON.stringify(ifaceOut.lines))
const ipOut = executeCommand(d, 'ip address 192.168.1.1 255.255.255.0')
console.log('DEBUG ip out:', JSON.stringify(ipOut.lines), 'ip:', d.interfaces[0].ip, 'mask:', d.interfaces[0].mask)
found = findLesson('router', 'r-iface-ip')!
step('r-iface-ip passes', found.lesson.check(d, {}) === null)
found = findLesson('router', 'r-no-shut')!
step('r-no-shut fails before no shut', found.lesson.check(d, {}) !== null)
executeCommand(d, 'no shutdown')
step('r-no-shut passes', found.lesson.check(d, {}) === null)

// Wrong IP gives educational feedback
const wrong = createRouterDevice()
executeCommand(wrong, 'enable')
executeCommand(wrong, 'configure terminal')
executeCommand(wrong, 'interface gigabitEthernet0/0')
executeCommand(wrong, 'ip address 192.168.1.2 255.255.255.0')
found = findLesson('router', 'r-iface-ip')!
const feedback = found.lesson.check(wrong, {})
step('wrong IP feedback mentions required address', Boolean(feedback && feedback.includes('192.168.1.1/24')))

// Password flow: fresh device with secret requires the password at enable
const p = createRouterDevice()
executeCommand(p, 'enable')
executeCommand(p, 'configure terminal')
executeCommand(p, 'enable secret netforge')
executeCommand(p, 'end')
executeCommand(p, 'disable') // back to user EXEC so `enable` prompts again
let out = executeCommand(p, 'enable')
step('enable prompts for password', out.lines[0] === 'Password:')
step('wrong password rejected', executeCommand(p, 'wrong').lines.includes('Password:'))
step('right password enters privileged', executeCommand(p, 'netforge').lines.length === 0 && p.mode === 'privileged')

// Static route + verification lesson
const r = createRouterDevice()
executeCommand(r, 'enable')
executeCommand(r, 'configure terminal')
executeCommand(r, 'ip route 192.168.2.0 255.255.255.0 192.168.1.2')
found = findLesson('router', 'r-static-route')!
step('static route fails without verification', found.lesson.check(r, {}) !== null)
executeCommand(r, 'end')
executeCommand(r, 'show ip route')
step('static route passes after show ip route', found.lesson.check(r, {}) === null)

// Switch: VLAN → access port dependency
const s = createSwitchDevice()
executeCommand(s, 'enable')
executeCommand(s, 'configure terminal')
executeCommand(s, 'interface fastEthernet0/1')
executeCommand(s, 'switchport mode access')
executeCommand(s, 'switchport access vlan 10')
step('access vlan 10 rejected before vlan exists', s.interfaces[0].accessVlan === 1)
executeCommand(s, 'vlan 10')
executeCommand(s, 'name STUDENTS')
executeCommand(s, 'interface fastEthernet0/1')
executeCommand(s, 'switchport access vlan 10')
step('access vlan 10 accepted after vlan exists', s.interfaces[0].accessVlan === 10)
found = findLesson('switch', 's-vlan')!
step('s-vlan passes', found.lesson.check(s, {}) === null)

// Endpoint lessons: PC diagnose scenario
const foundPc = findLesson('pc', 'p-diagnose')!
const pc = (await import('@/devicelab/cli')).createEndpoint('pc', 'PC-01')
foundPc.lesson.setup!(pc)
step('p-diagnose starts with wrong gateway', (pc as { gateway: string }).gateway === '192.168.1.254')
step('p-diagnose fails before fix', foundPc.lesson.check(pc, {}) !== null)

// Course counts match the spec
for (const course of COURSES) {
  step(`${course.kind} course has lessons`, allLessons(course).length > 0)
}
step('router = 14 lessons', allLessons(COURSES[0]).length === 14)
step('switch = 12 lessons', allLessons(COURSES[1]).length === 12)
step('server = 8 lessons', allLessons(COURSES[2]).length === 8)
step('pc = 6 lessons', allLessons(COURSES[3]).length === 6)

console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
export type { CliDevice }
