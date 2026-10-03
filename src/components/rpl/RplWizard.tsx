import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, FileText, Image as ImageIcon, Trash2, Upload,
} from 'lucide-react';
import type { CandidateProfile, RplAssessment, RplEvidenceItem, RplEvidenceKind } from '../../rpl/types';
import type { RplRole } from '../../rpl/roles';
import { RPL_LANGUAGES, RPL_PRIVACY_NOTICE } from '../../rpl/types';
import { RPL_ROLES, getRole } from '../../rpl/roles';
import { makeId } from '../../rpl/storage';

const EVIDENCE_KINDS: RplEvidenceKind[] = [
  'Certificate', 'Experience Letter', 'Training Document', 'Portfolio File', 'Project Documentation', 'Image', 'Other',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB metadata guard
const ALLOWED_EXT = /\.(pdf|docx?|jpe?g|png|webp|txt)$/i;

export function RplStepper({ step }: { step: number }) {
  const stages = ['Profile', 'Evidence', 'Skill Mapping', 'Assessment', 'Skill Gap', 'Report'];
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-semibold" aria-label="Assessment progress">
      {stages.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 ${
              i < step ? 'bg-good-soft text-good' : i === step ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'text-ink-faint'
            }`}
          >
            {i < step ? '✓ ' : `${i + 1}. `}{s}
          </span>
          {i < stages.length - 1 && <span className="text-ink-faint">→</span>}
        </li>
      ))}
    </ol>
  );
}

interface Props {
  assessment: RplAssessment;
  onChange: (a: RplAssessment) => void;
  onAnalyze: () => void;
  onExit: () => void;
}

export default function RplWizard({ assessment, onChange, onAnalyze, onExit }: Props) {
  const [step, setStep] = useState(0); // 0 profile, 1 role, 2 experience, 3 evidence
  const [roleQuery, setRoleQuery] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [manual, setManual] = useState({ name: '', kind: 'Certificate' as RplEvidenceKind, date: '', skill: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const manualNameRef = useRef<HTMLInputElement>(null);

  const filteredRoles = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return RPL_ROLES;
    return RPL_ROLES.filter((r) => r.name.toLowerCase().includes(q) || r.competencies.some((c) => c.toLowerCase().includes(q)));
  }, [roleQuery]);

  const profile: CandidateProfile = assessment.profile;
  const profileValid = profile.fullName.trim() && profile.age.trim() && profile.occupation.trim() && profile.yearsExperience.trim();
  const canAnalyze = assessment.roleId && assessment.experience.text.trim().length >= 30;

  const patch = (p: Partial<RplAssessment>) => onChange({ ...assessment, ...p });

  const setProfile = (p: Partial<CandidateProfile>) => patch({ profile: { ...profile, ...p } });

  const pickRole = (r: RplRole) => patch({ roleId: r.id, roleName: r.name, competencies: r.competencies });

  const addFiles = (files: FileList | null) => {
    setFileError(null);
    if (!files || files.length === 0) return;
    const items: RplEvidenceItem[] = [];
    for (const f of Array.from(files)) {
      if (!ALLOWED_EXT.test(f.name)) {
        setFileError(`"${f.name}" is not an accepted file type (PDF, DOC/DOCX, images or TXT only).`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        setFileError(`"${f.name}" is larger than 10 MB. Please upload a smaller file.`);
        continue;
      }
      const isImage = /\.(jpe?g|png|webp)$/i.test(f.name);
      const kind: RplEvidenceKind = isImage ? 'Image' : 'Other';
      items.push({
        id: makeId('ev'),
        name: f.name.replace(/\.[^.]+$/, ''),
        kind,
        date: new Date().toISOString().slice(0, 10),
        relatedSkill: '',
        status: 'Uploaded',
        fileName: f.name,
        fileType: f.type || 'application/octet-stream',
        fileSize: f.size,
      });
    }
    if (items.length) patch({ evidence: [...assessment.evidence, ...items] });
  };

  const addManual = () => {
    if (!manual.name.trim()) return;
    const item: RplEvidenceItem = {
      id: makeId('ev'),
      name: manual.name.trim(),
      kind: manual.kind,
      date: manual.date || new Date().toISOString().slice(0, 10),
      relatedSkill: manual.skill.trim(),
      status: 'Candidate Provided',
    };
    patch({ evidence: [...assessment.evidence, item] });
    setManual({ name: '', kind: 'Certificate', date: '', skill: '' });
  };

  const removeEvidence = (id: string) => patch({ evidence: assessment.evidence.filter((e) => e.id !== id) });

  const updateEvidence = (id: string, p: Partial<RplEvidenceItem>) =>
    patch({ evidence: assessment.evidence.map((e) => (e.id === id ? { ...e, ...p } : e)) });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="card p-6 sm:p-8">
        <RplStepper step={Math.min(step === 0 ? 0 : step <= 2 ? 1 : 2, 5)} />
        <div className="mt-6">
          {step === 0 && (
            <>
              <h1 className="font-display text-2xl font-extrabold text-ink">Candidate Profile</h1>
              <p className="mt-1 text-sm text-ink-soft">Tell us who you are. We never ask for documents here — only basics.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Full name</span>
                  <input value={profile.fullName} onChange={(e) => setProfile({ fullName: e.target.value })} className="input mt-1 w-full" placeholder="e.g. Arun Kumar" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Age</span>
                  <input value={profile.age} onChange={(e) => setProfile({ age: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" className="input mt-1 w-full" placeholder="e.g. 29" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Location</span>
                  <input value={profile.location} onChange={(e) => setProfile({ location: e.target.value })} className="input mt-1 w-full" placeholder="City, State" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Education</span>
                  <input value={profile.education} onChange={(e) => setProfile({ education: e.target.value })} className="input mt-1 w-full" placeholder="e.g. 10th standard, ITI, Diploma…" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Current occupation</span>
                  <input value={profile.occupation} onChange={(e) => setProfile({ occupation: e.target.value })} className="input mt-1 w-full" placeholder="e.g. Electrician" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Years of experience</span>
                  <input value={profile.yearsExperience} onChange={(e) => setProfile({ yearsExperience: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" className="input mt-1 w-full" placeholder="e.g. 5" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Employment type</span>
                  <select value={profile.employmentType} onChange={(e) => setProfile({ employmentType: e.target.value })} className="input mt-1 w-full">
                    <option value="">Select…</option>
                    {['Self-employed', 'Employer', 'Salaried - private', 'Salaried - government', 'Contract / daily wage', 'Family business', 'Unemployed / between work'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Preferred language</span>
                  <select value={profile.language} onChange={(e) => setProfile({ language: e.target.value })} className="input mt-1 w-full">
                    {RPL_LANGUAGES.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="font-display text-2xl font-extrabold text-ink">Select your skill / job role</h1>
              <p className="mt-1 text-sm text-ink-soft">Search for the work you do. Each role has its own competency framework.</p>
              <input
                value={roleQuery}
                onChange={(e) => setRoleQuery(e.target.value)}
                className="input mt-4 w-full"
                placeholder="Search roles — e.g. electric, weld, tailor, web developer…"
                aria-label="Search roles"
              />
              <div className="mt-4 grid max-h-96 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredRoles.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => pickRole(r)}
                    className={`rounded-xl border p-3.5 text-left transition ${
                      assessment.roleId === r.id
                        ? 'border-brand-200 bg-brand-50 shadow-sm'
                        : 'border-line bg-paper hover:border-brand-200 hover:bg-brand-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{r.name}</span>
                      {assessment.roleId === r.id && <BadgeCheck className="h-4.5 w-4.5 shrink-0 text-brand-600" aria-hidden="true" />}
                    </div>
                    <div className="mt-1 text-xs text-ink-faint">{r.competencies.length} competencies · e.g. {r.competencies.slice(0, 2).join(', ')}</div>
                  </button>
                ))}
                {filteredRoles.length === 0 && (
                  <div className="col-span-full rounded-xl border border-line bg-paper p-4 text-sm text-ink-soft">
                    No matching role. Pick the closest one — or describe your work in the next step and the AI will map it.
                  </div>
                )}
              </div>
              {assessment.roleId && (
                <p className="mt-3 text-sm text-ink-soft">
                  Selected: <strong className="text-ink">{assessment.roleName}</strong> — {getRole(assessment.roleId)?.competencies.length} competencies.
                </p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="font-display text-2xl font-extrabold text-ink">Tell us what you already know.</h1>
              <p className="mt-1 text-sm text-ink-soft">
                Everything counts: jobs, apprenticeships, internships, informal training, self-learning, projects, volunteer and family business experience.
              </p>
              <label className="mt-5 block">
                <span className="text-sm font-semibold text-ink">Describe your experience in your own words</span>
                <textarea
                  value={assessment.experience.text}
                  onChange={(e) => patch({ experience: { ...assessment.experience, text: e.target.value } })}
                  className="input mt-1 min-h-36 w-full"
                  placeholder="I have worked as an electrician for 5 years. I install domestic wiring, repair switches and sockets, troubleshoot electrical faults and perform basic maintenance."
                />
              </label>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Previous jobs / apprenticeships</span>
                  <textarea
                    value={assessment.experience.jobs}
                    onChange={(e) => patch({ experience: { ...assessment.experience, jobs: e.target.value } })}
                    className="input mt-1 min-h-20 w-full"
                    placeholder="e.g. Helper at Murugan Electricals (2019-2021), own electrical contracting since 2021"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-ink">Informal training / self-learning</span>
                  <textarea
                    value={assessment.experience.training}
                    onChange={(e) => patch({ experience: { ...assessment.experience, training: e.target.value } })}
                    className="input mt-1 min-h-20 w-full"
                    placeholder="e.g. Learned wiring from my uncle; watched repair videos; 3-day safety workshop"
                  />
                </label>
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-ink">Tools / equipment you use</span>
                <input
                  value={assessment.experience.tools}
                  onChange={(e) => patch({ experience: { ...assessment.experience, tools: e.target.value } })}
                  className="input mt-1 w-full"
                  placeholder="e.g. Multimeter, tester, wire stripper, drill machine"
                />
              </label>
              <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/50 p-3.5 text-xs text-ink-soft">
                💡 Tip: mention specific work — “installed wiring in 6 houses”, “repaired 3-phase motors” — it strengthens your evidence.
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="font-display text-2xl font-extrabold text-ink">Evidence Portfolio</h1>
              <p className="mt-1 text-sm text-ink-soft">
                Record the documents that prove your experience. {RPL_PRIVACY_NOTICE}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button onClick={() => fileRef.current?.click()} className="card flex items-center gap-3 p-4 text-left transition hover:border-brand-200">
                  <Upload className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-ink">Upload files</span>
                    <span className="block text-xs text-ink-faint">PDF, DOC/DOCX, images · max 10 MB</span>
                  </span>
                </button>
                <button onClick={() => manualNameRef.current?.focus()} className="card flex items-center gap-3 p-4 text-left transition hover:border-brand-200">
                  <ImageIcon className="h-5 w-5 shrink-0 text-accent-600" aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-semibold text-ink">Add evidence manually</span>
                    <span className="block text-xs text-ink-faint">No file? Add details yourself below</span>
                  </span>
                </button>
              </div>

              {/* Manual evidence entry (both buttons scroll here; second is quick-add) */}
              <div className="mt-4 rounded-xl border border-line bg-paper p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-ink-soft">Evidence name</span>
                    <input ref={manualNameRef} value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} className="input mt-1 w-full" placeholder="e.g. Experience letter — Sri Murugan Electricals" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-ink-soft">Type</span>
                      <select value={manual.kind} onChange={(e) => setManual({ ...manual, kind: e.target.value as RplEvidenceKind })} className="input mt-1 w-full">
                        {EVIDENCE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-ink-soft">Date</span>
                      <input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} className="input mt-1 w-full" />
                    </label>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input value={manual.skill} onChange={(e) => setManual({ ...manual, skill: e.target.value })} className="input flex-1" placeholder="Related skill (optional) — e.g. Electrical Wiring" />
                  <button onClick={addManual} disabled={!manual.name.trim()} className="btn btn-primary btn-md shrink-0">Add Evidence</button>
                </div>
              </div>

              {fileError && <div className="mt-3 rounded-xl border border-bad-soft bg-bad-soft p-3 text-sm text-bad">{fileError}</div>}

              <ul className="mt-4 space-y-2.5">
                {assessment.evidence.map((e) => (
                  <li key={e.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {e.kind === 'Image' ? <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden="true" /> : <FileText className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{e.name}</div>
                        <div className="mt-0.5 text-xs text-ink-faint">
                          {e.kind} · {e.date}{e.fileSize ? ` · ${(e.fileSize / 1024).toFixed(0)} KB` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={e.relatedSkill}
                        onChange={(ev) => updateEvidence(e.id, { relatedSkill: ev.target.value })}
                        className="input h-9 w-auto max-w-44 py-1 text-xs"
                        aria-label="Related skill"
                      >
                        <option value="">Related skill…</option>
                        {assessment.competencies.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span className={`pill text-[11px] ${e.status === 'Uploaded' ? 'border-brand-200 text-brand-700' : ''}`}>{e.status}</span>
                      <button onClick={() => removeEvidence(e.id)} className="btn btn-ghost h-9 w-9 p-0 text-bad" aria-label={`Remove ${e.name}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {assessment.evidence.length === 0 && (
                <p className="mt-4 text-sm text-ink-soft">No evidence yet — you can continue without any, but evidence raises your readiness.</p>
              )}
            </>
          )}
        </div>

        {/* Nav buttons */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            onClick={() => (step === 0 ? onExit() : setStep(step - 1))}
            className="btn btn-ghost btn-md"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {step === 0 ? 'Exit' : 'Back'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 0 ? !profileValid : step === 1 ? !assessment.roleId : assessment.experience.text.trim().length < 30}
              className="btn btn-primary btn-md"
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button onClick={onAnalyze} disabled={!canAnalyze} className="btn btn-primary btn-md">
              Analyze My Skills
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {!profileValid && step === 0 && (
          <p className="mt-2 text-right text-xs text-ink-faint">Name, age, occupation and years of experience are required.</p>
        )}
        {step === 3 && !canAnalyze && (
          <p className="mt-2 text-right text-xs text-ink-faint">Write at least a couple of sentences about your experience to continue.</p>
        )}
      </div>
      <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
