// ---------------------------------------------------------------------------
// Occupational Competency Graph — the knowledge base that grounds every
// scenario. The LLM generates VARIATIONS within these boundaries; it never
// invents competencies, safety rules or expected decisions on its own.
//
// Pilot occupation: EV Service Technician (visible DEMO OCCUPATION label).
// The registry below is the extension point for future occupations.
// ---------------------------------------------------------------------------

import type { Occupation, SafetyRule } from './types';

export const SAFETY_RULES: Record<string, SafetyRule> = {
  HV_ISOLATION: {
    id: 'HV_ISOLATION',
    name: 'Power down & isolate the high-voltage system',
    detail:
      'The service disconnect must be removed and the pack contactors opened before any high-voltage intervention. This rule is deterministic — no AI assessment can override it.',
  },
  HV_PPE: {
    id: 'HV_PPE',
    name: 'Wear Class-0 insulating gloves & eye protection',
    detail:
      'Personal protective equipment rated for the pack voltage is mandatory before approaching exposed HV terminals.',
  },
  HV_VERIFY: {
    id: 'HV_VERIFY',
    name: 'Verify 0 V with a rated meter before contact',
    detail:
      'Voltage must be measured and confirmed at zero with a CAT-rated meter after isolation and before touching any conductor. This rule is deterministic — it cannot be waived by judgement call.',
  },
  CHARGE_DISABLE: {
    id: 'CHARGE_DISABLE',
    name: 'Disable charging before battery intervention',
    detail: 'The charger must be unplugged and charging disabled before opening or testing the battery pack.',
  },
};

export const EV_SERVICE_TECHNICIAN: Occupation = {
  id: 'ev-service-technician',
  name: 'EV Service Technician',
  tag: 'DEMO OCCUPATION',
  description:
    'Two- and three-wheeler electric vehicle service — battery packs, BMS, chargers, wiring and thermal systems.',
  competencies: [
    {
      id: 'battery-diagnostics',
      name: 'Battery Diagnostics',
      icon: '🔋',
      description: 'Measure, interpret and diagnose battery pack behaviour from live data.',
    },
    {
      id: 'bms-troubleshooting',
      name: 'BMS Troubleshooting',
      icon: '🧠',
      description: 'Interpret battery-management-system readings, warnings and logs correctly.',
    },
    {
      id: 'electrical-safety',
      name: 'Electrical Safety',
      icon: '⚠️',
      description: 'Follow mandatory isolation, PPE and verification procedures for HV work.',
    },
    {
      id: 'fault-isolation',
      name: 'Fault Isolation',
      icon: '🔍',
      description: 'Narrow a symptom down to the failing component, even with conflicting evidence.',
    },
    {
      id: 'charging-systems',
      name: 'Charging Systems',
      icon: '🔌',
      description: 'Diagnose chargers, connectors and charging faults end to end.',
    },
    {
      id: 'thermal-management',
      name: 'Thermal Management',
      icon: '🌡️',
      description: 'Recognise and act on abnormal pack and motor temperatures.',
    },
  ],
};

/**
 * Occupation registry — the extension point for future pilots. Only the EV
 * technician is validated for this demo; the others are labelled COMING SOON
 * and disabled rather than pretended.
 */
export const OCCUPATIONS: Occupation[] = [
  EV_SERVICE_TECHNICIAN,
  {
    id: 'electrical-technician',
    name: 'Electrical Technician',
    tag: 'COMING SOON',
    description: 'Wiring, switchboards, motors and industrial electrical maintenance.',
    competencies: [],
  },
  {
    id: 'solar-installation-technician',
    name: 'Solar Installation Technician',
    tag: 'COMING SOON',
    description: 'PV array installation, commissioning, string diagnostics and site safety.',
    competencies: [],
  },
];

export function getOccupation(id: string): Occupation {
  return OCCUPATIONS.find((o) => o.id === id) ?? EV_SERVICE_TECHNICIAN;
}

export function getSafetyRule(id: string): SafetyRule {
  return (
    SAFETY_RULES[id] ?? {
      id,
      name: id,
      detail: 'Mandatory safety procedure.',
    }
  );
}
