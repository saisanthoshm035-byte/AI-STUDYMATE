// Occupation competency frameworks for RPL assessment.
// Each role defines the competency list the candidate's skills are mapped against.

export interface RplRole {
  id: string;
  name: string;
  competencies: string[];
}

export const RPL_ROLES: RplRole[] = [
  {
    id: 'electrician',
    name: 'Electrician',
    competencies: ['Electrical Safety', 'Wiring', 'Circuit Installation', 'Equipment Handling', 'Fault Diagnosis', 'Maintenance', 'Tools & Instruments'],
  },
  {
    id: 'welder',
    name: 'Welder',
    competencies: ['Welding Safety', 'Arc Welding', 'Gas Welding & Cutting', 'Joint Preparation', 'Weld Inspection', 'Equipment Setup', 'Blueprint Reading'],
  },
  {
    id: 'fitter',
    name: 'Fitter',
    competencies: ['Measurement & Marking', 'Fitting & Assembly', 'Machine Basics', 'Precision Checking', 'Blueprint Reading', 'Tool Maintenance', 'Workshop Safety'],
  },
  {
    id: 'plumber',
    name: 'Plumber',
    competencies: ['Pipe Fitting', 'Water Supply Systems', 'Sanitary & Drainage', 'Leak Detection & Repair', 'Fixture Installation', 'Plumbing Safety', 'Tools & Instruments'],
  },
  {
    id: 'carpenter',
    name: 'Carpenter',
    competencies: ['Measurement & Marking', 'Joinery', 'Furniture Making', 'Shuttering & Formwork', 'Tool Handling', 'Finishing', 'Site Safety'],
  },
  {
    id: 'tailor',
    name: 'Tailor',
    competencies: ['Body Measurement', 'Cutting', 'Stitching', 'Pattern Making', 'Alterations', 'Fabric Knowledge', 'Machine Operation'],
  },
  {
    id: 'beautician',
    name: 'Beautician',
    competencies: ['Skin Care & Facials', 'Hair Cutting & Styling', 'Hair Colouring', 'Threading & Waxing', 'Hygiene & Sanitation', 'Client Consultation', 'Product Knowledge'],
  },
  {
    id: 'automotive-technician',
    name: 'Automotive Technician',
    competencies: ['Engine Systems', 'Braking Systems', 'Automotive Electrical Systems', 'Diagnostics', 'Routine Servicing', 'Transmission Basics', 'Workshop Safety'],
  },
  {
    id: 'construction-worker',
    name: 'Construction Worker',
    competencies: ['Masonry', 'Concrete Work', 'Scaffolding Awareness', 'Site Safety', 'Steel Fixing', 'Plastering', 'Material Handling'],
  },
  {
    id: 'machine-operator',
    name: 'Machine Operator',
    competencies: ['Machine Setup', 'Operation & Monitoring', 'Quality Checking', 'Preventive Maintenance', 'Safety Procedures', 'Material Loading', 'Fault Reporting'],
  },
  {
    id: 'data-entry-operator',
    name: 'Data Entry Operator',
    competencies: ['Typing Speed & Accuracy', 'Data Formatting', 'Spreadsheet Software', 'Database Basics', 'Verification & Proofing', 'Office Software', 'Data Privacy Awareness'],
  },
  {
    id: 'graphic-designer',
    name: 'Graphic Designer',
    competencies: ['Design Principles', 'Typography', 'Color Theory', 'Image Editing Software', 'Vector Illustration', 'Branding & Layout', 'Client Communication'],
  },
  {
    id: 'web-developer',
    name: 'Web Developer',
    competencies: ['HTML & CSS', 'JavaScript', 'Responsive Design', 'Backend Basics', 'Version Control', 'Debugging', 'Web Performance'],
  },
  {
    id: 'digital-marketing-executive',
    name: 'Digital Marketing Executive',
    competencies: ['Social Media Marketing', 'SEO Basics', 'Content Creation', 'Campaign Analytics', 'Email Marketing', 'Paid Ads Basics', 'Client Reporting'],
  },
  {
    id: 'healthcare-assistant',
    name: 'Healthcare Assistant',
    competencies: ['Patient Care Basics', 'Hygiene & Infection Control', 'Vital Signs Monitoring', 'Mobility Assistance', 'First Aid Basics', 'Patient Communication', 'Equipment Handling'],
  },
  {
    id: 'retail-associate',
    name: 'Retail Associate',
    competencies: ['Customer Service', 'Billing & POS Systems', 'Stock Management', 'Merchandising', 'Product Knowledge', 'Complaint Handling', 'Cash Handling'],
  },
  {
    id: 'hospitality-worker',
    name: 'Hospitality Worker',
    competencies: ['Guest Service', 'Food Safety & Hygiene', 'Housekeeping Standards', 'Order Taking & Service', 'Conflict Resolution', 'Cash Handling', 'Workplace Safety'],
  },
  {
    id: 'agriculture-worker',
    name: 'Agriculture Worker',
    competencies: ['Crop Cultivation', 'Soil Preparation', 'Irrigation Basics', 'Pest & Weed Management', 'Harvesting & Post-Harvest', 'Farm Tools & Machinery', 'Farm Safety'],
  },
];

export function getRole(idOrName: string): RplRole | null {
  const needle = idOrName.trim().toLowerCase();
  return (
    RPL_ROLES.find((r) => r.id === needle || r.name.toLowerCase() === needle) ?? null
  );
}
