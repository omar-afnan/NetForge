import type { InteractiveLesson } from './types'

/**
 * The transport-layer concept labs: TCP, UDP, and a TCP-vs-UDP decision lab.
 * Same step model as the IPv4 & CIDR lesson - visual, short explanation,
 * interaction, checkpoint - hosted by InteractiveLessonRunner. None of these
 * have a bespoke practice surface, so they end on a recap step.
 */

export const TCP_LESSON: InteractiveLesson = {
  id: 'tcp',
  labNumber: 'LAB 05',
  title: 'Understanding TCP',
  subtitle: 'Connections, acknowledgements and reliable delivery',
  minutes: 10,
  outcomes: [
    'Why TCP sets up a connection before sending data',
    'The three-way handshake, step by step',
    'How sequence and acknowledgement numbers line up',
    'How TCP detects a lost segment and resends it',
    'What "reliable, ordered delivery" actually means',
  ],
  concepts: ['tcp'],
  steps: [
    {
      id: 'why-connection',
      kind: 'teach',
      title: 'TCP agrees to talk before it talks',
      body: 'TCP is connection-oriented: the two sides exchange a few small packets to synchronise before any real data moves. That setup is what lets TCP promise every byte arrives, in order, even if the network loses some along the way.',
      diagram:
        'App data  ->  TCP segment (SEQ, ACK, flags)  ->  IP packet  ->  frame\n              \\__ numbered so nothing is lost or reordered __/',
      concept: 'tcp',
    },
    {
      id: 'handshake',
      kind: 'interact',
      title: 'The three-way handshake',
      body: 'Press through the three packets. Watch the sequence number each side picks, and how the ACK number is always "the next byte I expect from you".',
      widget: 'tcp-handshake',
      concept: 'tcp',
    },
    {
      id: 'check-handshake',
      kind: 'question',
      title: 'Checkpoint: handshake order',
      question: {
        prompt: 'What is the correct order of the TCP three-way handshake?',
        options: ['SYN -> ACK -> SYN-ACK', 'SYN -> SYN-ACK -> ACK', 'ACK -> SYN -> SYN-ACK', 'SYN-ACK -> SYN -> ACK'],
        answerIndex: 1,
        explain:
          'The client sends SYN (proposing its start sequence). The server replies SYN-ACK (acknowledging the client AND proposing its own sequence). The client sends ACK. Only then does data flow.',
      },
      concept: 'tcp',
    },
    {
      id: 'reliability',
      kind: 'interact',
      title: 'A lost segment, found and resent',
      body: 'The same five segments, but the network drops number 3. Step through and watch TCP notice the gap and retransmit - the receiver never hands segment 4 to the app until 3 is in place.',
      widget: 'tcp-reliability',
      widgetProps: { mode: 'tcp' },
      concept: 'tcp',
    },
    {
      id: 'check-retransmit',
      kind: 'question',
      title: 'Checkpoint: detecting loss',
      question: {
        prompt: 'Segment 3 is lost. Segments 4 and 5 still arrive. How does the sender learn 3 is missing?',
        options: [
          'The network sends an error message',
          'The receiver keeps ACKing the last in-order byte - duplicate ACKs pile up',
          'A timer on segment 5 expires',
          'The receiver closes the connection',
        ],
        answerIndex: 1,
        explain:
          'The receiver can only acknowledge bytes it has in order. Each out-of-order arrival makes it re-send the same ACK ("still waiting for 3"). Three duplicate ACKs trigger a fast retransmit of segment 3.',
      },
      concept: 'tcp',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'That is the whole promise of TCP',
      body: 'Set up a connection, number every byte, acknowledge what arrives, resend what does not, and hand the application a clean in-order stream. HTTP, SSH and email all lean on it. The cost is round trips and bookkeeping - which is exactly what UDP throws away.',
      concept: 'tcp',
    },
  ],
}

export const UDP_LESSON: InteractiveLesson = {
  id: 'udp',
  labNumber: 'LAB 06',
  title: 'Understanding UDP',
  subtitle: 'Fire-and-forget datagrams',
  minutes: 8,
  outcomes: [
    'What "connectionless" means in practice',
    'Why UDP has no handshake and no acknowledgements',
    'What happens to a lost datagram (nothing)',
    'Where lower overhead beats guaranteed delivery',
  ],
  concepts: ['udp'],
  steps: [
    {
      id: 'connectionless',
      kind: 'teach',
      title: 'UDP just sends',
      body: 'No handshake, no connection state, no acknowledgements, no retransmission. A UDP datagram is a stamped envelope dropped in the post: source and destination ports, a length, a checksum, and your data. An 8-byte header versus TCP\'s 20+.',
      diagram:
        'UDP datagram:  [ src port | dst port | length | checksum ]  + data\n               8-byte header - and that is the entire protocol',
      concept: 'udp',
    },
    {
      id: 'loss',
      kind: 'interact',
      title: 'A lost datagram stays lost',
      body: 'Five datagrams, number 3 dropped. Step through: nothing detects the loss, nothing resends it, and datagram 4 is handed to the app straight away - ahead of the gap.',
      widget: 'tcp-reliability',
      widgetProps: { mode: 'udp' },
      concept: 'udp',
    },
    {
      id: 'check-loss',
      kind: 'question',
      title: 'Checkpoint: what UDP does about loss',
      question: {
        prompt: 'A UDP datagram is dropped in transit. What does UDP do?',
        options: [
          'Retransmits it after a timeout',
          'Nothing - it is up to the application to notice or not care',
          'Sends a NACK to the sender',
          'Closes the socket',
        ],
        answerIndex: 1,
        explain:
          'UDP has no delivery guarantee and no feedback channel. If loss matters, the application (or a protocol built on top of UDP) has to handle it. Often it genuinely does not matter - one lost audio frame is inaudible.',
      },
      concept: 'udp',
    },
    {
      id: 'where-udp-wins',
      kind: 'teach',
      title: 'When fire-and-forget is the right call',
      body: 'DNS: one small question, one small answer - a handshake would triple the latency for nothing. Voice and video calls: a 200 ms-late retransmission is worse than a tiny glitch. Online games: only the newest position matters, resending a stale one is pointless.',
      concept: 'udp',
    },
    {
      id: 'check-use',
      kind: 'question',
      title: 'Checkpoint: pick the UDP case',
      question: {
        prompt: 'Which of these is the best fit for UDP?',
        options: [
          'Downloading a software update',
          'A live voice call',
          'Logging into a server over SSH',
          'Loading a web page',
        ],
        answerIndex: 1,
        explain:
          'A voice call values timeliness over perfection - a late packet is useless, so there is no point resending it. The other three need every byte intact and in order, which is TCP\'s job.',
      },
      concept: 'udp',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'UDP in one line',
      body: 'Minimal overhead, no guarantees. Perfect when speed and simplicity matter more than never losing a packet - and a poor choice when they do not.',
      concept: 'udp',
    },
  ],
}

export const TCP_VS_UDP_LESSON: InteractiveLesson = {
  // id is distinct from the text lesson 'tcp-vs-udp' in the same module so
  // their Learn-progress keys never collide.
  id: 'tcp-udp-choose',
  labNumber: 'LAB 07',
  title: 'TCP vs UDP: Choosing',
  subtitle: 'Which transport does the job need?',
  minutes: 7,
  outcomes: [
    'The property-by-property difference between TCP and UDP',
    'How to reason about a protocol choice from the app\'s needs',
    'Why each common service picks the transport it does',
  ],
  concepts: ['tcp', 'udp'],
  steps: [
    {
      id: 'compare',
      kind: 'demo',
      title: 'Side by side',
      body: 'Same job, two trade-offs. Read down the table, then decide five real cases.',
      widget: 'transport-compare',
      concept: 'tcp',
    },
    {
      id: 'q-web',
      kind: 'question',
      title: 'Case 1: loading a web page',
      question: {
        prompt: 'A browser fetches an HTML page and its images. TCP or UDP?',
        options: ['TCP', 'UDP'],
        answerIndex: 0,
        explain:
          'A missing byte corrupts the page. The content must arrive complete and in order, and a page load can tolerate a handshake. That is TCP (HTTP/1 and HTTP/2 run on it).',
      },
      concept: 'tcp',
    },
    {
      id: 'q-dns',
      kind: 'question',
      title: 'Case 2: a DNS lookup',
      question: {
        prompt: 'A host resolves example.com to an IP address. TCP or UDP?',
        options: ['TCP', 'UDP'],
        answerIndex: 1,
        explain:
          'One tiny request, one tiny reply. UDP avoids a three-packet handshake for a two-packet exchange. If the answer is lost, the resolver just asks again. (DNS falls back to TCP only for large responses.)',
      },
      concept: 'udp',
    },
    {
      id: 'q-voice',
      kind: 'question',
      title: 'Case 3: a live voice call',
      question: {
        prompt: 'Two people are on a VoIP call. TCP or UDP?',
        options: ['TCP', 'UDP'],
        answerIndex: 1,
        explain:
          'Audio is real-time. A packet that arrives late after a retransmission is useless - the moment has passed. UDP lets the codec skip the gap and keep going.',
      },
      concept: 'udp',
    },
    {
      id: 'q-file',
      kind: 'question',
      title: 'Case 4: downloading a large file',
      question: {
        prompt: 'A user downloads a 2 GB installer. TCP or UDP?',
        options: ['TCP', 'UDP'],
        answerIndex: 0,
        explain:
          'Every byte must be correct or the installer is broken. Order and completeness matter far more than shaving off a few round trips. TCP.',
      },
      concept: 'tcp',
    },
    {
      id: 'recap',
      kind: 'teach',
      title: 'The rule of thumb',
      body: 'Need every byte, in order, no matter what? TCP. Need it fast and lightweight, and can you live with an occasional gap? UDP. Almost every protocol choice comes down to that one question.',
      concept: 'tcp',
    },
  ],
}

export const TRANSPORT_LESSONS: InteractiveLesson[] = [TCP_LESSON, UDP_LESSON, TCP_VS_UDP_LESSON]
