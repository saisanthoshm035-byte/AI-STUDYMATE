// Built-in fallback question set — used only when the AI question engine is
// unreachable (e.g., offline), so an assessment in progress is never blocked.
export const RPL_FALLBACK_QUESTIONS = [
  {
    type: 'Situational',
    competency: 'Electrical Safety',
    difficulty: 'Beginner',
    prompt: 'What would you do before working on an electrical circuit?',
    options: ['Turn off the supply and verify with a tester that it is dead', 'Work quickly while the current is on', 'Wear gloves only if the wire looks damaged', 'Ask the customer to hold the wire'],
    correctAnswer: 0,
    guidance: 'Isolating supply and proving dead is the core safe-isolation procedure.',
  },
  {
    type: 'Scenario',
    competency: 'Fault Diagnosis',
    difficulty: 'Intermediate',
    prompt: 'You are installing a domestic circuit and the circuit breaker trips repeatedly. What steps would you take to identify the problem?',
    options: [
      'Keep resetting the breaker until it holds',
      'Unplug all appliances, check the wiring for damage or moisture, test the circuit section by section with a multimeter, then restore loads one at a time',
      'Replace the breaker with a bigger one',
      'Bypass the breaker with a direct wire',
    ],
    correctAnswer: 1,
    guidance: 'Systematic isolation of sections and loads; never bypass protection.',
  },
  {
    type: 'Technical',
    competency: 'Wiring',
    difficulty: 'Intermediate',
    prompt: 'Which wire is normally used for the earth connection in domestic wiring in India?',
    options: ['Red', 'Green or green-yellow stripe', 'Black', 'Blue'],
    correctAnswer: 1,
    guidance: 'Earth is green/green-yellow per IS standard colour code.',
  },
  {
    type: 'Scenario',
    competency: 'Circuit Installation',
    difficulty: 'Advanced',
    prompt: 'A customer wants a new AC (1.5 ton) on a circuit shared with other room loads. What do you check before connecting it?',
    options: [
      'Nothing — the AC will work on any circuit',
      'Load calculation: the AC full-load current, wire current-carrying capacity, and whether the MCB rating and earthing suit a dedicated circuit',
      'Only whether the plug fits the socket',
      'Whether the room has good paint',
    ],
    correctAnswer: 1,
    guidance: 'Load calculation and dedicated-circuit sizing are the professional expectation.',
  },
  {
    type: 'Experience-based',
    competency: 'Maintenance',
    difficulty: 'Intermediate',
    prompt: 'Describe how you diagnosed an electrical fault in your previous work. What did you check first and why?',
    options: [],
    correctAnswer: -1,
    guidance: 'Strong answers mention systematic checks: supply, connections, load, appliance isolation, safe isolation before touching.',
  },
] as const;
