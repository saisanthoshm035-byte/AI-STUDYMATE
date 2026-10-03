// Demo assessment content — clearly marked as demo data, never real candidate info.
export const RPL_DEMO_PROFILE = {
  fullName: 'Arun Kumar',
  age: '29',
  location: 'Coimbatore, Tamil Nadu',
  education: '10th standard',
  occupation: 'Electrician',
  yearsExperience: '5',
  employmentType: 'Self-employed / contractor',
  language: 'English',
};

export const RPL_DEMO_EXPERIENCE =
  'I have worked as an electrician for 5 years. I install domestic wiring, repair switches and sockets, troubleshoot electrical faults and perform basic maintenance. I always follow electrical safety procedures — I switch off the supply and check with a tester before starting any repair. I learned wiring and repair work by helping my uncle who runs an electrical shop, then worked on my own for customers in my area. I use a multimeter, tester, wire stripper and insulation tape daily. I have wired several new houses and repaired motors and pumps.';

export const RPL_DEMO_EVIDENCE = [
  { name: 'Experience Letter — Sri Murugan Electricals', kind: 'Experience Letter', date: '2025-06-10', relatedSkill: 'Wiring, Maintenance', status: 'Uploaded', fileName: 'experience-letter-sample.pdf', fileType: 'application/pdf', fileSize: 182_400, demo: true },
  { name: 'House wiring project photo', kind: 'Image', date: '2025-08-02', relatedSkill: 'Circuit Installation', status: 'Uploaded', fileName: 'wiring-project-sample.jpg', fileType: 'image/jpeg', fileSize: 460_800, demo: true },
  { name: 'ITI short-course certificate (wireman trade)', kind: 'Certificate', date: '2021-05-15', relatedSkill: 'Electrical Safety', status: 'Uploaded', fileName: 'training-certificate-sample.pdf', fileType: 'application/pdf', fileSize: 220_100, demo: true },
] as const;

export const RPL_DEMO_SKILLS = [
  { name: 'Electrical Wiring', category: 'Technical skill', confidence: 'High confidence', source: 'Work experience + uploaded evidence' },
  { name: 'Circuit Installation', category: 'Technical skill', confidence: 'High confidence', source: 'Work experience + uploaded evidence' },
  { name: 'Fault Diagnosis', category: 'Technical skill', confidence: 'High confidence', source: 'Work experience' },
  { name: 'Electrical Safety', category: 'Knowledge area', confidence: 'High confidence', source: 'Training certificate' },
  { name: 'Maintenance', category: 'Technical skill', confidence: 'Medium confidence', source: 'Work experience' },
  { name: 'Tools & Instruments', category: 'Tool', confidence: 'High confidence', source: 'Work experience (multimeter, tester, wire stripper)' },
  { name: 'Customer Communication', category: 'Soft skill', confidence: 'Medium confidence', source: 'Work experience' },
  { name: 'Load Calculation', category: 'Knowledge area', confidence: 'Needs evidence', source: 'Not mentioned' },
] as const;

export const RPL_DEMO_MAPPINGS = [
  { competency: 'Electrical Safety', evidence: 'Training certificate + experience', status: 'Demonstrated' },
  { competency: 'Wiring', evidence: 'Work experience + portfolio', status: 'Demonstrated' },
  { competency: 'Circuit Installation', evidence: 'Work experience + project image', status: 'Demonstrated' },
  { competency: 'Equipment Handling', evidence: 'Work experience', status: 'Demonstrated' },
  { competency: 'Fault Diagnosis', evidence: 'Work experience', status: 'Partially Demonstrated' },
  { competency: 'Maintenance', evidence: 'Work experience', status: 'Demonstrated' },
  { competency: 'Tools & Instruments', evidence: 'Work experience', status: 'Demonstrated' },
] as const;

export const RPL_DEMO_QUESTIONS = [
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
