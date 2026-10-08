// ---------------------------------------------------------------------------
// Curated scenario bank — EV Service Technician pilot (DEMO OCCUPATION).
//
// Every node is grounded in the competency graph. The LLM may only RE-SKIN
// presentation (customer report, live data, prompt) — actions, branches and
// safety requirements always stay deterministic and expert-defined.
//
// Levels: 1 basic task · 2 multiple causes · 3 intermittent fault ·
// 4 conflicting evidence · 5 safety-critical · 6 unexpected complication.
// ---------------------------------------------------------------------------

import type { ScenarioNode } from './types';

const SCANNER = { id: 'scanner', label: 'Diagnostic Scanner', icon: '📟' };
const METER = { id: 'meter', label: 'Multimeter', icon: '🔬' };
const THERMAL = { id: 'thermal', label: 'Thermal Camera', icon: '🌡️' };
const VISUAL = { id: 'visual', label: 'Visual Inspection', icon: '👁️' };
const PPE = { id: 'ppe', label: 'PPE Kit', icon: '🧤' };
const INSULATED = { id: 'insulated', label: 'Insulated Tools', icon: '🔧' };

export const SCENARIOS: Record<string, ScenarioNode> = {
  // ------------------------------------------------------------- Level 1
  'ev-l1-power-loss': {
    id: 'ev-l1-power-loss',
    level: 1,
    competency: 'battery-diagnostics',
    title: 'The 15-Minute Shutdown',
    customerReport:
      '"My scooter shuts off after about 15 minutes of riding. It starts again after it cools down. It\'s doing this every day now."',
    systemData: [
      { label: 'Battery (rest)', value: '51.2 V', status: 'ok' },
      { label: 'Motor temp', value: '52 °C', status: 'ok' },
      { label: 'Odometer', value: '4,120 km', status: 'idle' },
      { label: 'Ride mode', value: 'ECO', status: 'idle' },
    ],
    tools: [SCANNER, METER, THERMAL, VISUAL],
    prompt: 'The customer is waiting. What do you do first?',
    actions: [
      {
        id: 'scan-codes',
        label: 'Run the diagnostic scanner — fault codes & pack history',
        icon: '📟',
        competency: 'battery-diagnostics',
        verdict: 'correct',
        capabilities: ['Reads fault data before touching hardware', 'Uses structured diagnosis'],
        response:
          'Scanner: no stored DTCs, but the BMS log shows a 4.1 V pack sag under throttle for ~8 s before each shutdown. The cutoff is load-related, not random.',
        dataChanges: { 'BMS log': '4.1 V sag under load @ cutoff' },
        next: 'ev-l2-no-charge',
      },
      {
        id: 'visual-check',
        label: 'Visual inspection — connectors & wiring',
        icon: '👁️',
        competency: 'fault-isolation',
        verdict: 'suboptimal',
        capabilities: ['Performs a baseline check'],
        response:
          'Connectors are clean and seated. A fine baseline — but you have a scanner and a repeating pattern. Use the data first.',
        next: 'ev-l2-no-charge',
      },
      {
        id: 'cool-down-test',
        label: 'Ask the customer to wait and retest when cool',
        icon: '⏳',
        competency: 'battery-diagnostics',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'The customer already told you it recovers when cool. Waiting reproduces the complaint without isolating anything.',
        next: 'ev-l2-no-charge',
      },
      {
        id: 'replace-pack',
        label: 'Order a replacement battery pack',
        icon: '📦',
        competency: 'battery-diagnostics',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'A full pack swap with zero measurements is an expensive guess. The 15-minute pattern points to something load-related — diagnose first.',
        next: 'ev-l1b-visual',
      },
    ],
    next: 'ev-l2-no-charge',
    onIncorrect: 'ev-l1b-visual',
    aiVariation: 'stress-symptom',
    source: 'curated',
  },

  // Guided retry (Level 1, different competency)
  'ev-l1b-visual': {
    id: 'ev-l1b-visual',
    level: 1,
    competency: 'fault-isolation',
    title: 'Dim Lights, Weak Horn',
    customerReport:
      '"Also — my delivery e-bike\'s headlight is dim and the horn is weak. The main battery seems fine."',
    systemData: [
      { label: 'Main pack', value: '51.4 V', status: 'ok' },
      { label: 'Headlight rail', value: '8.1 V', status: 'warn' },
      { label: 'Horn', value: 'weak', status: 'warn' },
      { label: 'DC-DC converter', value: '?', status: 'idle' },
    ],
    tools: [METER, VISUAL, SCANNER],
    prompt: 'Main pack is healthy. Where is the fault?',
    actions: [
      {
        id: 'measure-aux',
        label: 'Measure the 12 V auxiliary rail / DC-DC output',
        icon: '🔬',
        competency: 'fault-isolation',
        verdict: 'correct',
        capabilities: ['Isolates the failing subsystem', 'Measures before replacing'],
        response:
          'Auxiliary rail reads 8.1 V instead of ~12 V. The aux battery feeding lights and horn is failing — main pack was never the problem.',
        dataChanges: { 'DC-DC converter': '8.1 V out (low)' },
        next: 'ev-l2-no-charge',
      },
      {
        id: 'replace-bulb',
        label: 'Replace the headlight bulb',
        icon: '💡',
        competency: 'fault-isolation',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'A new bulb will be just as dim — the 8 V rail is the symptom, and the horn proves it is not the bulb.',
        next: 'ev-l2-no-charge',
      },
      {
        id: 'resolder-horn',
        label: 'Re-solder the horn connector',
        icon: '🔩',
        competency: 'fault-isolation',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'The horn and the light share the weak rail. One low reading explains both — measure the source, not one consumer.',
        next: 'ev-l2-no-charge',
      },
    ],
    next: 'ev-l2-no-charge',
    source: 'curated',
  },

  // ------------------------------------------------------------- Level 2
  'ev-l2-no-charge': {
    id: 'ev-l2-no-charge',
    level: 2,
    competency: 'charging-systems',
    title: 'Won\'t Charge Overnight',
    customerReport:
      '"I left it charging all night and the pack is still at two bars. The charger light stays green the whole time."',
    systemData: [
      { label: 'Wall socket', value: '230 V', status: 'ok' },
      { label: 'Charger output', value: '0.3 A', status: 'warn' },
      { label: 'Charge port', value: '0.0 V', status: 'idle' },
      { label: 'BMS charge FET', value: 'closed', status: 'ok' },
    ],
    tools: [METER, SCANNER, VISUAL],
    prompt: 'Multiple things could be wrong. What do you check?',
    actions: [
      {
        id: 'measure-charger-dc',
        label: 'Measure the charger\'s DC output under load',
        icon: '🔌',
        competency: 'charging-systems',
        verdict: 'correct',
        capabilities: ['Tests the source before the sink', 'Confirms wall power first'],
        response:
          'Wall socket: 230 V. Charger DC output under load: 0.3 A / 2 V. The BMS charge FET is open for business — the charger itself is dead.',
        dataChanges: { 'Charger output': '0.3 A / 2 V — faulty' },
        next: 'ev-l3-intermittent',
      },
      {
        id: 'order-charger',
        label: 'Order a new charger for the customer',
        icon: '📦',
        competency: 'charging-systems',
        verdict: 'suboptimal',
        capabilities: ['Right suspicion, insufficient proof'],
        response:
          'Probably right — but one measurement under load makes it certain. Never warranty a part on a hunch.',
        next: 'ev-l3-intermittent',
      },
      {
        id: 'replace-bms',
        label: 'Replace the BMS',
        icon: '🧠',
        competency: 'bms-troubleshooting',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'The BMS is the expensive guess. The charge FET is closed and the charger reports near-zero output — the fault is upstream.',
        next: 'ev-l3-intermittent',
      },
    ],
    next: 'ev-l3-intermittent',
    aiVariation: 'stress-symptom',
    source: 'curated',
  },

  // ------------------------------------------------------------- Level 3
  'ev-l3-intermittent': {
    id: 'ev-l3-intermittent',
    level: 3,
    competency: 'bms-troubleshooting',
    title: 'The Warning That Comes and Goes',
    customerReport:
      '"The BMS warning shows up maybe once a day, then disappears. The scooter feels normal otherwise."',
    systemData: [
      { label: 'BMS warning', value: 'intermittent', status: 'warn' },
      { label: 'Cell voltages', value: 'balanced · 3.92 V × 13', status: 'ok' },
      { label: 'Pack temp', value: '39 °C', status: 'warn' },
      { label: 'Ambient', value: '33 °C', status: 'ok' },
      { label: 'Fast-charges today', value: '3', status: 'idle' },
    ],
    tools: [SCANNER, THERMAL, METER, VISUAL],
    prompt: 'An intermittent fault you can\'t see on request. What\'s your move?',
    actions: [
      {
        id: 'log-fast-charge',
        label: 'Attach the data logger and run a controlled fast-charge',
        icon: '📈',
        competency: 'bms-troubleshooting',
        verdict: 'correct',
        capabilities: ['Reproduces the fault before replacing parts', 'Reads BMS logs systematically'],
        response:
          'During the controlled fast-charge, cell 9 climbs 6 °C above its neighbours mid-session while voltages stay balanced. The anomaly is localised — sensor or cell-9, now with data.',
        dataChanges: { 'Cell-9 temp': '+6 °C vs neighbours', 'BMS warning': 'reproduced' },
        next: 'ev-l4-conflict',
      },
      {
        id: 'replace-temp-sensor',
        label: 'Replace the pack temperature sensor',
        icon: '🌡️',
        competency: 'bms-troubleshooting',
        verdict: 'suboptimal',
        capabilities: ['Plausible hypothesis, unverified'],
        response:
          'Plausible — but you haven\'t reproduced it yet. Log first: the data may point at cell 9, not the sensor.',
        next: 'ev-l4-conflict',
      },
      {
        id: 'blame-ambient',
        label: 'Explain it as normal hot-weather behaviour',
        icon: '☀️',
        competency: 'thermal-management',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          '33 °C ambient doesn\'t produce an intermittent BMS warning on a balanced pack. Don\'t explain away data you haven\'t collected.',
        next: 'ev-l4-conflict',
      },
      {
        id: 'clear-codes',
        label: 'Clear the BMS warning and return the scooter',
        icon: '🧹',
        competency: 'bms-troubleshooting',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'Clearing an unreproduced intermittent fault sends it back onto the road. The log will still be there when it fails harder.',
        next: 'ev-l4-conflict',
      },
    ],
    next: 'ev-l4-conflict',
    aiVariation: 'misleading-customer',
    source: 'curated',
  },

  // ------------------------------------------------------------- Level 4
  'ev-l4-conflict': {
    id: 'ev-l4-conflict',
    level: 4,
    competency: 'fault-isolation',
    title: 'Two Instruments Disagree',
    customerReport:
      '"Your own scanner said cell 3 is failing. Now you\'re telling me the meter says it\'s fine? Which is it?"',
    systemData: [
      { label: 'Scanner · cell-3', value: '3.10 V under load', status: 'alert' },
      { label: 'Multimeter · cell-3', value: '3.90 V at rest', status: 'ok' },
      { label: 'Cell-3 temp', value: '+6 °C vs neighbours', status: 'warn' },
      { label: 'Sense harness', value: 'looks factory', status: 'idle' },
    ],
    tools: [METER, SCANNER, VISUAL, THERMAL],
    prompt: 'Conflicting evidence. What settles it?',
    actions: [
      {
        id: 'load-test-terminal',
        label: 'Re-measure cell 3 under load at the pack terminals & inspect its sense-wire connector',
        icon: '🔬',
        competency: 'fault-isolation',
        verdict: 'correct',
        capabilities: ['Trusts direct measurement under the failing condition', 'Rules out instrumentation before parts'],
        response:
          'Under load at the terminals, cell 3 holds 3.88 V — but the cell-3 sense-wire crimp measures 0.4 Ω. The scanner was reading through a resistive joint. The wiring is the fault, not the cell.',
        dataChanges: { 'Sense harness': 'cell-3 crimp 0.4 Ω', 'Scanner · cell-3': 'false reading (harness)' },
        next: 'ev-l5-hv-safety',
      },
      {
        id: 'replace-scanner',
        label: 'Send the scanner for calibration',
        icon: '📟',
        competency: 'fault-isolation',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'Maybe — but your own under-load test at the terminals settles it in five minutes without a service round-trip.',
        next: 'ev-l5-hv-safety',
      },
      {
        id: 'replace-cell3',
        label: 'Replace cell 3',
        icon: '🔋',
        competency: 'fault-isolation',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'The cell measures healthy at rest and under load. Swapping it likely won\'t fix a wiring-reading mismatch.',
        next: 'ev-l5-hv-safety',
      },
      {
        id: 'reset-bms',
        label: 'Reset the BMS and close the job',
        icon: '🧹',
        competency: 'bms-troubleshooting',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'A reset hides the mismatch while the resistive crimp keeps heating under load — that\'s a latent defect on a pack.',
        next: 'ev-l5-hv-safety',
      },
    ],
    next: 'ev-l5-hv-safety',
    aiVariation: 'prior-work',
    source: 'curated',
  },

  // ------------------------------------------------------------- Level 5
  'ev-l5-hv-safety': {
    id: 'ev-l5-hv-safety',
    level: 5,
    competency: 'electrical-safety',
    title: 'Crash-Damaged Pack',
    customerReport:
      '"It was in an accident. The case is dented and there\'s a sweet smell inside. Can you just check it quickly so I can ride tomorrow?"',
    systemData: [
      { label: 'Pack damage', value: 'case dent', status: 'alert' },
      { label: 'Smell', value: 'solvent (electrolyte)', status: 'alert' },
      { label: 'Pack voltage', value: '48.9 V', status: 'idle' },
      { label: 'Service disconnect', value: 'in place', status: 'idle' },
    ],
    tools: [PPE, INSULATED, METER, SCANNER],
    prompt: 'Damaged high-voltage pack on your bench. Safety steps first — the engine checks.',
    actions: [
      {
        id: 'wear-ppe',
        label: 'Put on Class-0 insulating gloves & eye protection',
        icon: '🧤',
        competency: 'electrical-safety',
        completes: ['HV_PPE'],
        verdict: 'correct',
        capabilities: ['Protects self before exposure'],
        response: 'You suit up. Insulating gloves rated for the pack voltage, eye protection on.',
        next: 'stay',
      },
      {
        id: 'isolate-pack',
        label: 'Remove the service disconnect & isolate the pack',
        icon: '⛔',
        competency: 'electrical-safety',
        completes: ['HV_ISOLATION'],
        verdict: 'correct',
        capabilities: ['Isolates stored energy before work'],
        response:
          'Service disconnect removed, contactors open. The pack is now electrically isolated from the vehicle harness.',
        dataChanges: { 'Service disconnect': 'removed — isolated' },
        next: 'stay',
      },
      {
        id: 'verify-zero',
        label: 'Verify 0 V at the terminals with the HV-rated meter',
        icon: '🔬',
        competency: 'electrical-safety',
        requires: ['HV_ISOLATION', 'HV_PPE'],
        completes: ['HV_VERIFY'],
        verdict: 'correct',
        capabilities: ['Verifies de-energised state before contact'],
        response:
          'CAT III meter across the terminals: 0.0 V, confirmed twice. De-energised and verified.',
        dataChanges: { 'Pack voltage': '0.0 V — verified' },
        next: 'stay',
      },
      {
        id: 'quick-visual',
        label: 'External visual only — note the dent and smell',
        icon: '👁️',
        competency: 'electrical-safety',
        verdict: 'suboptimal',
        capabilities: ['Reasonable observation, incomplete procedure'],
        response:
          'Documenting the damage is right — but a dented pack with electrolyte smell needs the full isolation, PPE and verification procedure before anything more.',
        next: 'stay',
      },
      {
        id: 'open-cover-inspect',
        label: 'Open the case and inspect the cells',
        icon: '🔧',
        competency: 'electrical-safety',
        requires: ['HV_ISOLATION', 'HV_PPE', 'HV_VERIFY'],
        verdict: 'correct',
        capabilities: ['Completes the full HV safety chain before entry'],
        response:
          'With isolation, PPE and 0 V verified, you open the case: one cell shows electrolyte staining. The pack is quarantined for safe discharge and disposal. Customer is told: not rideable tomorrow.',
        dataChanges: { 'Cell damage': 'electrolyte staining — quarantined' },
        next: 'adaptive',
      },
      {
        id: 'grab-pack',
        label: 'Lift the pack onto the work mat to look closer',
        icon: '🙌',
        competency: 'electrical-safety',
        requires: ['HV_ISOLATION', 'HV_PPE'],
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'Physically handling a damaged, still-energised pack is not a diagnostic step. Isolate, suit up, verify 0 V — then inspect.',
        next: 'stay',
      },
    ],
    next: null,
    source: 'curated',
  },

  // ------------------------------------------------------------- Level 6
  'ev-l6-complication': {
    id: 'ev-l6-complication',
    level: 6,
    competency: 'battery-diagnostics',
    title: 'The Previous Workshop\'s Surprise',
    customerReport:
      '"Another shop replaced a cell module last week. The same 15-minute shutdown is back. They said it\'s definitely the new module."',
    systemData: [
      { label: 'Cell-9 shunt', value: 'non-OEM, undocumented', status: 'alert' },
      { label: 'Harness', value: 're-crimped (non-factory)', status: 'warn' },
      { label: 'Module', value: 'new — other workshop', status: 'idle' },
      { label: 'Shutdown pattern', value: 'identical to before', status: 'warn' },
    ],
    tools: [METER, SCANNER, VISUAL, INSULATED],
    prompt: 'Someone modified this machine before you. What now?',
    actions: [
      {
        id: 'restore-oem',
        label: 'Compare against the wiring diagram — remove the shunt, restore the harness',
        icon: '📐',
        competency: 'battery-diagnostics',
        verdict: 'correct',
        capabilities: ['Detects undocumented modifications', 'Refuses to inherit someone else\'s misdiagnosis'],
        response:
          'With OEM wiring restored, the pack behaves normally under a full load test. The shunt was masking cell-9\'s real reading — the replaced module was never the fault.',
        dataChanges: { 'Cell-9 shunt': 'removed — OEM wiring restored', 'Shutdown pattern': 'resolved' },
        next: null,
      },
      {
        id: 'replace-module-again',
        label: 'Replace the cell module again',
        icon: '🔋',
        competency: 'battery-diagnostics',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'The module is brand new. The non-OEM shunt and re-crimped harness are the new variables — address those first.',
        next: null,
      },
      {
        id: 'keep-shunt',
        label: 'Keep the shunt and re-tune the BMS around it',
        icon: '🎛️',
        competency: 'battery-diagnostics',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'Tuning around an undocumented modification hides an unknown defect — a safety, warranty and fire-risk hazard.',
        next: null,
      },
    ],
    next: null,
    source: 'curated',
  },

  // -------------------------------------------------- Stress test (thermal)
  'ev-l3-stress-thermal': {
    id: 'ev-l3-stress-thermal',
    level: 3,
    competency: 'thermal-management',
    title: 'Too Hot to Charge?',
    customerReport:
      '"Now it won\'t charge at all — and the charger says \'battery too hot\'. But it\'s evening, it\'s cool outside."',
    systemData: [
      { label: 'Pack temp', value: '45 °C', status: 'alert' },
      { label: 'Charger status', value: 'thermal derating', status: 'warn' },
      { label: 'BMS charge FET', value: 'open', status: 'warn' },
      { label: 'Last ride', value: '40 km, ended 10 min ago', status: 'idle' },
    ],
    tools: [THERMAL, METER, SCANNER, VISUAL],
    prompt: 'Charging fault — or something protecting the pack?',
    actions: [
      {
        id: 'wait-verify-derating',
        label: 'Verify the derating curve — retest charging below 40 °C',
        icon: '📉',
        competency: 'thermal-management',
        verdict: 'correct',
        capabilities: ['Separates protective derating from real faults'],
        response:
          'At 43 °C the pack charges normally. The 45 °C reading right after a 40 km ride is protective derating, not a charger fault — the customer was told to let it cool.',
        dataChanges: { 'Charger status': 'charging normally @ 43 °C' },
        next: 'adaptive',
      },
      {
        id: 'replace-charger-hot',
        label: 'Replace the charger',
        icon: '📦',
        competency: 'charging-systems',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'The charger did exactly what it should — it refused to push current into a 45 °C pack. Test the temperature dependency before condemning hardware.',
        next: 'adaptive',
      },
      {
        id: 'force-charge',
        label: 'Force charging past the BMS limit',
        icon: '⚡',
        competency: 'electrical-safety',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'Bypassing a thermal protection limit to satisfy a test is exactly how packs catch fire. Never defeat a safety derating.',
        next: 'adaptive',
      },
    ],
    next: 'adaptive',
    source: 'curated',
  },

  // ------------------------------------------------- Micro-bridge scenarios
  'ev-m1-bms-sim': {
    id: 'ev-m1-bms-sim',
    level: 2,
    competency: 'bms-troubleshooting',
    title: 'Reading the Log Like a Technician',
    customerReport: 'No customer — this one is between you and the BMS log.',
    systemData: [
      { label: 'Log A · cell-9 temp', value: '+6 °C jump in 2 s', status: 'warn' },
      { label: 'Log B · cell-9 voltage', value: 'stable 3.92 V', status: 'ok' },
      { label: 'Log C · pack current', value: 'smooth throughout', status: 'ok' },
    ],
    tools: [SCANNER, METER, THERMAL],
    prompt: 'Three log lines. Sensor fault — or real cell fault?',
    actions: [
      {
        id: 'identify-sensor',
        label: 'Sensor fault — temp jumps with stable voltage & smooth current',
        icon: '📈',
        competency: 'bms-troubleshooting',
        verdict: 'correct',
        capabilities: ['Reads multi-signal logs together'],
        response:
          'Exactly. A real hot cell shifts voltage and draws attention in the current profile. A temperature that spikes 6 °C in two seconds while voltage and current stay smooth is a sensor or connector glitch.',
        next: 'ev-m2-bms-challenge',
      },
      {
        id: 'identify-cell',
        label: 'Cell fault — cell 9 is failing thermally',
        icon: '🔋',
        competency: 'bms-troubleshooting',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'A genuinely failing cell shows itself in voltage and current behaviour first. Here both are rock stable — reread the three logs together.',
        next: 'ev-m2-bms-challenge',
      },
      {
        id: 'order-sensor',
        label: 'Just order a new temperature sensor',
        icon: '📦',
        competency: 'bms-troubleshooting',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'Right instinct, wrong proof. Say which log lines justify it — that reasoning is what separates swapping parts from diagnosing.',
        next: 'ev-m2-bms-challenge',
      },
    ],
    next: 'ev-m2-bms-challenge',
    source: 'curated',
  },

  'ev-m2-bms-challenge': {
    id: 'ev-m2-bms-challenge',
    level: 3,
    competency: 'bms-troubleshooting',
    title: 'Two Sensors, One Bus Bar',
    customerReport: 'Decision challenge — 3 minutes.',
    systemData: [
      { label: 'Sensor A (cell-9)', value: '25 °C', status: 'ok' },
      { label: 'Sensor B (cell-10)', value: '55 °C', status: 'alert' },
      { label: 'Bus bar A↔B', value: 'shared', status: 'idle' },
      { label: 'Pack load', value: 'idle', status: 'ok' },
    ],
    tools: [THERMAL, METER, SCANNER],
    prompt: 'Same bus bar, 30 °C apart. Decide.',
    actions: [
      {
        id: 'cross-check-camera',
        label: 'Cross-check with the thermal camera under a small load',
        icon: '🌡️',
        competency: 'bms-troubleshooting',
        verdict: 'correct',
        capabilities: ['Trusts an independent measurement over conflicting pairs'],
        response:
          'Thermal camera under 5 A load: bus bar evenly warm, cell-10 slightly warm — sensor B reads high. Instrumentation fault confirmed with an independent source.',
        next: 'ev-r-bms-reassess',
      },
      {
        id: 'average-readings',
        label: 'Average the two readings and move on',
        icon: '➗',
        competency: 'bms-troubleshooting',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'Averaging conflicting inputs hides the fault. One of these sensors is lying — find out which before the BMS acts on bad data.',
        next: 'ev-r-bms-reassess',
      },
      {
        id: 'replace-bms-board',
        label: 'Replace the whole BMS board',
        icon: '🧠',
        competency: 'bms-troubleshooting',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'The board is fine — one sensor is not. Replacing the BMS is the most expensive way to avoid a two-minute thermal check.',
        next: 'ev-r-bms-reassess',
      },
    ],
    next: 'ev-r-bms-reassess',
    source: 'curated',
  },

  'ev-r-bms-reassess': {
    id: 'ev-r-bms-reassess',
    level: 4,
    competency: 'bms-troubleshooting',
    title: 'Reassessment: Regen Spike',
    customerReport:
      '"Since the firmware update, the BMS logs cell 9 spiking 0.4 V above the pack every time I brake."',
    systemData: [
      { label: 'Cell-9 @ regen', value: '+0.4 V spike', status: 'alert' },
      { label: 'Cell-9 @ rest', value: '3.91 V — balanced', status: 'ok' },
      { label: 'Sense pin 4', value: '0.3 Ω (spec < 0.1 Ω)', status: 'warn' },
      { label: 'Charge FET', value: 'normal', status: 'ok' },
    ],
    tools: [METER, SCANNER, VISUAL, THERMAL],
    prompt: 'BMS blames the cell. The harness disagrees. Decide.',
    actions: [
      {
        id: 'replace-sense-pin',
        label: 'Rebuild the sense harness — pin 4 is out of spec',
        icon: '🔧',
        competency: 'bms-troubleshooting',
        verdict: 'correct',
        capabilities: ['Applies conflicting-evidence reasoning to a new situation', 'Checks instrumentation before the cell'],
        response:
          'Pin 4 at 0.3 Ω distorts exactly the readings that load with current — like regen. Harness rebuilt, spike gone. Transfer confirmed.',
        dataChanges: { 'Cell-9 @ regen': 'normal — spike gone' },
        next: null,
      },
      {
        id: 'replace-cell9-regen',
        label: 'Replace cell 9',
        icon: '🔋',
        competency: 'bms-troubleshooting',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'The cell is balanced at rest and its only "evidence" flows through an out-of-spec pin. Check the instrumentation path first.',
        next: null,
      },
      {
        id: 'disable-regen',
        label: 'Disable regenerative braking',
        icon: '🚫',
        competency: 'bms-troubleshooting',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'Disabling a feature to hide a sensor-reading artefact costs the customer range and changes the vehicle — without fixing anything.',
        next: null,
      },
    ],
    next: null,
    source: 'curated',
  },

  // --------------------------------------- Micro-bridge chain: charging-systems
  'ev-m1-charging-sim': {
    id: 'ev-m1-charging-sim',
    level: 2,
    competency: 'charging-systems',
    title: 'Walk the Charging Chain',
    customerReport: '"It charges sometimes. Other nights, nothing at all."',
    systemData: [
      { label: 'Wall outlet', value: '230 V — good', status: 'ok' },
      { label: 'Charger output', value: '0.3 A when "failed"', status: 'alert' },
      { label: 'Port pins', value: 'one pin recessed', status: 'warn' },
      { label: 'BMS charge FET', value: 'closes on request', status: 'ok' },
    ],
    tools: [METER, SCANNER, VISUAL],
    prompt: 'Measure each link of the chain in order. Where is the break?',
    actions: [
      {
        id: 'probe-port-pin',
        label: 'Probe the recessed port pin under load with the meter',
        icon: '🔬',
        competency: 'charging-systems',
        verdict: 'correct',
        capabilities: ['Measures each link of the charging chain in order'],
        response:
          'Under charge load the recessed pin drops 9 V — a resistive contact. The charger is fine, the BMS is fine. The port is the broken link.',
        dataChanges: { 'Port pins': 'recessed pin drops 9 V under load' },
        next: 'ev-m2-charging-challenge',
      },
      {
        id: 'condemn-charger',
        label: 'Condemn the charger and quote a replacement',
        icon: '📦',
        competency: 'charging-systems',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'The outlet is good and the BMS closes its FET on request — walk the chain in order before condemning the expensive end.',
        next: 'ev-m2-charging-challenge',
      },
      {
        id: 'replace-bms-fet',
        label: 'Replace the BMS charge FET',
        icon: '🧠',
        competency: 'charging-systems',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'The FET closes on request — it is doing its job. The 9 V drop lives at the port pin you already saw recessed.',
        next: 'ev-m2-charging-challenge',
      },
    ],
    next: 'ev-m2-charging-challenge',
    source: 'curated',
  },

  'ev-m2-charging-challenge': {
    id: 'ev-m2-charging-challenge',
    level: 3,
    competency: 'charging-systems',
    title: 'The Charger That Hates Fast Charge',
    customerReport: '"Fast charge works at the shop, fails at home." Decision challenge — 3 minutes.',
    systemData: [
      { label: 'Home socket circuit', value: '16 A rated', status: 'warn' },
      { label: 'Charger brick temp', value: '61 °C at failure', status: 'alert' },
      { label: 'Charge rate', value: 'home: 10 A · shop: 15 A', status: 'idle' },
      { label: 'Cable', value: 'aftermarket, thinner gauge', status: 'warn' },
    ],
    tools: [METER, THERMAL, SCANNER],
    prompt: 'Works at the shop, fails at home. What differs?',
    actions: [
      {
        id: 'measure-vdrop-cable',
        label: 'Measure voltage drop across the aftermarket cable at 10 A',
        icon: '📉',
        competency: 'charging-systems',
        verdict: 'correct',
        capabilities: ['Compares failing vs non-failing conditions', 'Trusts measurement over part-swapping'],
        response:
          '2.1 V dropped across the thin aftermarket cable at 10 A — the brick heats, derates, and gives up. The charger never was the fault; the cable is.',
        dataChanges: { 'Cable': '2.1 V drop at 10 A — undersized' },
        next: 'ev-r-charging-reassess',
      },
      {
        id: 'blame-home-socket',
        label: 'Condemn the home socket circuit',
        icon: '🏠',
        competency: 'charging-systems',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'The circuit supplies 16 A fine until the cable cooks. Measure the drop across each segment before blaming the supply.',
        next: 'ev-r-charging-reassess',
      },
      {
        id: 'upgrade-charger',
        label: 'Sell a bigger charger to push through',
        icon: '🔌',
        competency: 'charging-systems',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'A bigger charger into a 2.1 V-drop cable means MORE heat, not a fix. That is how charging fires start.',
        next: 'ev-r-charging-reassess',
      },
    ],
    next: 'ev-r-charging-reassess',
    source: 'curated',
  },

  'ev-r-charging-reassess': {
    id: 'ev-r-charging-reassess',
    level: 4,
    competency: 'charging-systems',
    title: 'Reassessment: The Overnight Non-Charge',
    customerReport:
      '"Plugged in at 11 pm, woke up to 60% and a cold charger. My friend says the BMS slept."',
    systemData: [
      { label: 'Charge session log', value: 'ended 00:40, no error', status: 'warn' },
      { label: 'Charge FET', value: 'closed all night', status: 'ok' },
      { label: 'Timer/schedule', value: 'utility off-peak window set', status: 'alert' },
      { label: 'Pack voltage at 00:40', value: 'stopped at 54.4 V', status: 'idle' },
    ],
    tools: [SCANNER, METER, VISUAL],
    prompt: 'BMS did not sleep — the session ended. Why?',
    actions: [
      {
        id: 'check-charge-schedule',
        label: 'Read the off-peak schedule — session was cut by the utility timer',
        icon: '⏰',
        competency: 'charging-systems',
        verdict: 'correct',
        capabilities: ['Checks configuration before hardware', 'Reads session logs systematically'],
        response:
          'The utility off-peak timer ends sessions at 00:40 — the pack simply reached the window boundary at 54.4 V. Not the BMS, not the charger. Schedule explained, customer reassured.',
        dataChanges: { 'Timer/schedule': 'off-peak cut-off 00:40 — root cause' },
        next: null,
      },
      {
        id: 'reflash-bms',
        label: 'Reflash the BMS firmware',
        icon: '🧠',
        competency: 'charging-systems',
        verdict: 'suboptimal',
        capabilities: [],
        response:
          'The FET stayed closed and the log shows a clean session end — firmware is not the suspect. Check what scheduled the session.',
        next: null,
      },
      {
        id: 'replace-port-again',
        label: 'Replace the charging port',
        icon: '🔌',
        competency: 'charging-systems',
        verdict: 'incorrect',
        capabilities: [],
        response:
          'The port delivered current all evening — the session ended mid-charge by something upstream. Look at the timer.',
        next: null,
      },
    ],
    next: null,
    source: 'curated',
  },
};

export function getNode(id: string): ScenarioNode {
  const node = SCENARIOS[id];
  if (!node) throw new Error(`Unknown scenario node: ${id}`);
  return node;
}

/** The scripted 6-step demo path — judge experience in under 5 minutes. */
export const DEMO_CHAIN: string[] = [
  'ev-l1-power-loss',
  'ev-l2-no-charge',
  'ev-l3-intermittent',
  'ev-l4-conflict',
  'ev-l5-hv-safety',
  'ev-l6-complication',
];

/** Pool the adaptive (standard) mode draws from. */
export const ADAPTIVE_POOL: string[] = [
  'ev-l1-power-loss',
  'ev-l2-no-charge',
  'ev-l3-intermittent',
  'ev-l3-stress-thermal',
  'ev-l4-conflict',
  'ev-l5-hv-safety',
  'ev-l6-complication',
];

/** Micro-bridge chains keyed by competency. Reassessment always runs LAST. */
export const BRIDGE_CHAINS: Record<string, { interactive: string; challenge: string; reassessment: string }> = {
  'bms-troubleshooting': {
    interactive: 'ev-m1-bms-sim',
    challenge: 'ev-m2-bms-challenge',
    reassessment: 'ev-r-bms-reassess',
  },
  'charging-systems': {
    interactive: 'ev-m1-charging-sim',
    challenge: 'ev-m2-charging-challenge',
    reassessment: 'ev-r-charging-reassess',
  },
};

/** Bridge chain for a competency, or a registry-derived fallback if none is authored. */
export function getBridgeChain(competencyId: string): { interactive: string; challenge: string; reassessment: string } {
  const chain = BRIDGE_CHAINS[competencyId];
  if (chain) return chain;
  // No authored chain: reuse the closest available one so the loop still runs.
  return BRIDGE_CHAINS['bms-troubleshooting'];
}

// ---------------------------------------------------------------------------
// Curated reskins — deterministic fallbacks when the AI variation call fails.
// The AI may only replace presentation; these prove the shape.
// ---------------------------------------------------------------------------

import type { ScenarioReskin } from './types';

export const CURATED_RESKINS: Record<string, Record<string, ScenarioReskin>> = {
  'ev-l1-power-loss': {
    'stress-symptom': {
      customerReport:
        '"It\'s monsoon. My scooter shuts off after about 15 minutes of riding in the rain — and once it cut out on a flyover."',
      systemData: [
        { label: 'Battery (rest)', value: '51.2 V', status: 'ok' },
        { label: 'Motor temp', value: '52 °C', status: 'ok' },
        { label: 'Weather', value: 'heavy rain', status: 'warn' },
        { label: 'Odometer', value: '4,120 km', status: 'idle' },
      ],
      prompt: 'The customer mentions rain — does that change your first move?',
      note: 'Variation: weather-stress. Same instruments, new pressure on the same competency.',
    },
  },
  'ev-l2-no-charge': {
    'stress-symptom': {
      customerReport:
        '"I left it charging all night, still two bars. Also the charger fan never spins and the cable feels slightly warm."',
      systemData: [
        { label: 'Wall socket', value: '230 V', status: 'ok' },
        { label: 'Charger output', value: '0.3 A', status: 'warn' },
        { label: 'Charger fan', value: 'not spinning', status: 'warn' },
        { label: 'Cable', value: 'slightly warm', status: 'warn' },
      ],
      prompt: 'New details on the charger itself. Does your sequence change?',
      note: 'Variation: charger-stress. Same decision, richer evidence.',
    },
  },
  'ev-l3-intermittent': {
    'misleading-customer': {
      customerReport:
        '"It only happens when my wife rides it. Never for me. I think the scooter doesn\'t like her."',
      systemData: [
        { label: 'BMS warning', value: 'intermittent', status: 'warn' },
        { label: 'Cell voltages', value: 'balanced · 3.92 V × 13', status: 'ok' },
        { label: 'Pack temp', value: '39 °C', status: 'warn' },
        { label: 'Rider weight', value: 'varies', status: 'idle' },
      ],
      prompt: 'The customer has a theory. The logs don\'t. What do you trust?',
      note: 'Variation: misleading customer narrative — test evidence over anecdote.',
    },
    'prior-work': {
      customerReport:
        '"A roadside mechanic already \'fixed\' this twice. He replaced a wire near the battery. The warning came back in a day."',
      systemData: [
        { label: 'BMS warning', value: 'intermittent', status: 'warn' },
        { label: 'Cell voltages', value: 'balanced · 3.92 V × 13', status: 'ok' },
        { label: 'Pack temp', value: '39 °C', status: 'warn' },
        { label: 'Prior repair', value: 'unknown wire, taped', status: 'warn' },
      ],
      prompt: 'There\'s an undocumented repair in the harness. Factor it in.',
      note: 'Variation: prior undocumented work.',
    },
  },
  'ev-l4-conflict': {
    'prior-work': {
      customerReport:
        '"Your workshop already replaced the scanner cable last month. Are you sure the scanner isn\'t the problem again?"',
      systemData: [
        { label: 'Scanner · cell-3', value: '3.10 V under load', status: 'alert' },
        { label: 'Multimeter · cell-3', value: '3.90 V at rest', status: 'ok' },
        { label: 'Cell-3 temp', value: '+6 °C vs neighbours', status: 'warn' },
        { label: 'Scanner cable', value: 'replaced last month', status: 'idle' },
      ],
      prompt: 'The customer is pushing you toward the instrument. What actually settles it?',
      note: 'Variation: customer challenges the instrument.',
    },
  },
};
