import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, BookOpen, BrainCircuit, ChevronRight, FlaskConical, Lightbulb,
  MousePointerClick, RefreshCw, Search, ShieldCheck, Sparkles, Target, Zap,
  Award, Compass, FileSearch, GraduationCap, Radar,
} from 'lucide-react';
import Hero3D from './Hero3D';
import type { AiStatus } from '../types';

interface LandingProps {
  status: AiStatus | null;
  onStart: () => void;
  onPickTopic: (topic: string) => void;
  onGoRpl: () => void;
}

const CYCLE = [
  { icon: BookOpen, label: 'LEARN', desc: 'AI explains your topic at your level' },
  { icon: MousePointerClick, label: 'TEST', desc: 'Concept-based questions, one at a time' },
  { icon: Search, label: 'DETECT', desc: 'AI pinpoints the concept you missed' },
  { icon: RefreshCw, label: 'ADAPT', desc: 'The explanation changes strategy' },
  { icon: Target, label: 'MASTER', desc: 'Retry and measure real improvement' },
];

const HOW_STEPS = [
  {
    icon: BookOpen, step: '01', title: 'LEARN', glow: 'from-indigo-400 to-blue-500',
    body: 'Pick any topic and your level. AI StudyMate builds a structured lesson — summary, key concepts, a real-world connection and an analogy — shaped to how you\'re learning.',
  },
  {
    icon: MousePointerClick, step: '02', title: 'TEST', glow: 'from-cyan-400 to-sky-500',
    body: 'Instead of passively reading, you answer concept-based questions. Every question is tied to a specific concept, so each answer tells the AI exactly what it measures.',
  },
  {
    icon: Search, step: '03', title: 'DETECT', glow: 'from-amber-300 to-orange-500',
    body: 'Miss a question? The app maps it back to the underlying concept — so "I got question 3 wrong" becomes "the light-independent reactions need another look."',
  },
  {
    icon: RefreshCw, step: '04', title: 'ADAPT', glow: 'from-violet-400 to-fuchsia-500',
    body: 'The AI re-teaches the weak concept with a different strategy — an analogy, a step-by-step breakdown, a visual explanation — and tells you which approach it switched to.',
  },
  {
    icon: Target, step: '05', title: 'MASTER', glow: 'from-emerald-400 to-teal-500',
    body: 'A fresh question on the same concept checks whether the new explanation worked. Your improvement is measured, not assumed — and shown in a final learning summary.',
  },
];

const POPULAR = ['Photosynthesis', "Newton's Laws", 'Binary Search', 'Derivatives', 'DBMS Normalization', 'Machine Learning', 'Python Functions', 'The Water Cycle'];

/** Scroll-reveal wrapper (respects reduced motion). */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={shown ? 'reveal shown' : 'reveal'}
      style={shown ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

export default function Landing({ status, onStart, onPickTopic, onGoRpl }: LandingProps) {
  const live = status?.configured ?? false;

  return (
    <div className="sf-page">
      {/* ================= HERO ================= */}
      <section className="sf-hero relative overflow-hidden">
        {/* aurora backdrop */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-[15%] h-[28rem] w-[28rem] rounded-full bg-indigo-600/25 blur-[110px] sf-float" />
          <div className="absolute top-24 right-[-6%] h-[24rem] w-[24rem] rounded-full bg-cyan-500/20 blur-[100px] sf-float" style={{ animationDelay: '2s' }} />
          <div className="absolute bottom-[-30%] left-[40%] h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/15 blur-[110px] sf-float" style={{ animationDelay: '4s' }} />
          <div className="sf-grid absolute inset-0" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:pt-20">
          <div>
            <span className="sf-badge">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" aria-hidden="true" />
              {live ? 'Live AI engine · adaptive by design' : 'Adaptive AI learning engine — not a chatbot'}
            </span>

            <h1 className="sf-title mt-6 font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4rem]">
              Learn. Test. Adapt.
              <span className="sf-shimmer block">Master.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300/90">
              An AI companion that finds{' '}
              <em className="not-italic text-white">exactly what you don't understand</em>, re-teaches it a
              different way, reads how you explain it, and predicts what you'll forget.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <button onClick={onStart} className="sf-btn-primary btn btn-xl">
                Start Learning
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <a href="#how-it-works" className="sf-btn-ghost btn btn-xl">
                See How It Works
              </a>
            </div>

            <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
              {[
                { v: '3', l: 'intelligence layers' },
                { v: '10', l: 'questions at Advanced' },
                { v: '∞', l: 'topics, any level' },
              ].map((s) => (
                <div key={s.l} className="sf-stat">
                  <div className="sf-shimmer font-display text-2xl font-extrabold">{s.v}</div>
                  <div className="mt-0.5 text-[11px] leading-tight text-slate-400">{s.l}</div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm text-slate-500">
              No sign-up needed · 5–15 minute lessons · Works offline via fallbacks
            </p>
          </div>

          {/* Interactive 3D centerpiece */}
          <Reveal>
            <div className="sf-glass relative p-3 sm:p-4">
              <div className="mb-1 flex items-center justify-between px-2 pt-1">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-300">
                  <BrainCircuit className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                  Knowledge Constellation
                </div>
                <span className="sf-live-dot" aria-hidden="true" />
              </div>
              <Hero3D />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= LOOP STRIP ================= */}
      <section className="sf-strip">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-2 px-4 py-3.5 sm:px-6">
          {CYCLE.map((c, i) => (
            <span key={c.label} className="flex items-center gap-2">
              <span className="sf-chip">
                <c.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {c.label}
              </span>
              {i < CYCLE.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />}
            </span>
          ))}
          <span className="sf-chip sf-chip-good">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            measures improvement
          </span>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section id="how-it-works" className="relative py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="sf-badge">The loop is the product</span>
              <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                How it works
              </h2>
              <p className="mt-3 text-lg text-slate-400">
                Most AI tools answer questions. AI StudyMate runs a loop — and never lets a misunderstanding slip through.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {HOW_STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 90}>
                <div className="sf-card group h-full p-5 transition-transform duration-300 hover:-translate-y-1.5">
                  <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.glow} text-white shadow-lg`}>
                    <s.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="font-display text-xs font-bold text-slate-500">{s.step}</div>
                  <div className="font-display text-lg font-extrabold tracking-tight text-white">{s.title}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{s.body}</p>
                  <div className={`mt-4 h-px w-full bg-gradient-to-r ${s.glow} opacity-40 transition group-hover:opacity-90`} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================= COMPARISON ================= */}
      <section className="relative py-10 pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Not another AI chatbot
              </h2>
              <p className="mt-3 text-lg text-slate-400">
                The goal isn't to make AI smarter. The goal is to make learning more adaptive.
              </p>
            </div>
          </Reveal>

          <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
            <Reveal>
              <div className="sf-card h-full p-7 opacity-80">
                <div className="mb-4 flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-slate-500" aria-hidden="true" />
                  <h3 className="font-display text-lg font-bold text-slate-300">Generic AI chatbot</h3>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-slate-700/70 bg-slate-800/40 px-4 py-3 text-sm font-medium text-slate-400">
                  <span className="font-display font-bold">Ask</span>
                  <ChevronRight className="h-4 w-4 text-slate-600" aria-hidden="true" />
                  <span className="font-display font-bold">Answer</span>
                  <span className="ml-auto text-xs text-slate-500">…then what?</span>
                </div>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-400">
                  <li className="flex gap-2"><span aria-hidden="true">•</span> One explanation fits everyone, whether it landed or not</li>
                  <li className="flex gap-2"><span aria-hidden="true">•</span> No way to know what you actually understood</li>
                  <li className="flex gap-2"><span aria-hidden="true">•</span> Misunderstandings quietly pile up</li>
                </ul>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <div className="sf-card sf-card-hot relative h-full p-7">
                <span className="absolute -top-3 left-6 sf-badge sf-badge-hot">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  The StudyMate difference
                </span>
                <div className="mb-4 flex items-center gap-2 pt-1">
                  <Lightbulb className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                  <h3 className="font-display text-lg font-bold text-white">AI StudyMate</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-3 text-sm font-semibold text-indigo-200">
                  <span>Learn</span><ChevronRight className="h-4 w-4" aria-hidden="true" />
                  <span>Test</span><ChevronRight className="h-4 w-4" aria-hidden="true" />
                  <span>Detect</span><ChevronRight className="h-4 w-4" aria-hidden="true" />
                  <span>Adapt</span><ChevronRight className="h-4 w-4" aria-hidden="true" />
                  <span>Master</span>
                </div>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-300">
                  <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" aria-hidden="true" /> Explains at your level, then verifies understanding</li>
                  <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" aria-hidden="true" /> Reads how you explain it — not just what you click</li>
                  <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" aria-hidden="true" /> Predicts what you'll forget and schedules the review</li>
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================= POPULAR TOPICS ================= */}
      <section className="relative pb-24">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <Reveal>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-white">Popular topics</h2>
            <p className="mx-auto mt-2 max-w-xl text-slate-400">
              One tap loads it into the lesson builder. A full adaptive lesson takes about two minutes.
            </p>
            <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2.5">
              {POPULAR.map((t) => (
                <button key={t} onClick={() => onPickTopic(t)} className="sf-topic">
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-12">
              <button onClick={onStart} className="sf-btn-primary btn btn-xl">
                Start Learning
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= RPL SECTION ================= */}
      <section id="rpl" className="relative py-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute left-[10%] top-10 h-[22rem] w-[22rem] rounded-full bg-emerald-500/10 blur-[100px] sf-float" style={{ animationDelay: '1s' }} />
          <div className="absolute right-[8%] bottom-0 h-[20rem] w-[20rem] rounded-full bg-indigo-600/15 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <span className="sf-badge">
                <Award className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                New · AI-Assisted Skill Assessment for RPL
              </span>
              <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Have skills but no formal qualification?
              </h2>
              <p className="mt-3 text-lg text-slate-300/90">
                Your experience matters. Turn your experience into recognized skills.
              </p>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-400">
                AI-assisted assessment of skills gained through work experience, informal learning, training and prior education.
              </p>
            </div>
          </Reveal>

          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: Compass, label: 'Discover', desc: 'AI profiles your prior learning' },
              { icon: Radar, label: 'Map', desc: 'Skills mapped to the occupational framework' },
              { icon: Target, label: 'Assess', desc: 'Adaptive questions that follow your level' },
              { icon: FileSearch, label: 'Identify Gaps', desc: 'See what evidence is missing' },
              { icon: GraduationCap, label: 'Prepare', desc: 'Ready for the real RPL assessment' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 80}>
                <div className="sf-card h-full p-5 text-center">
                  <s.icon className="mx-auto h-6 w-6 text-emerald-300" aria-hidden="true" />
                  <div className="mt-2.5 font-display text-sm font-extrabold text-white">{s.label}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3.5">
              <button onClick={onGoRpl} className="sf-btn-primary btn btn-xl">
                Start RPL Assessment
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <a href="#rpl-how" className="sf-btn-ghost btn btn-xl">
                Explore How RPL Works
              </a>
            </div>
            <p className="mt-5 text-center text-xs text-slate-500">
              AI-assisted preliminary assessment — final competency decisions are made by authorized human assessors.
            </p>
          </Reveal>

          {/* How RPL works detail */}
          <div id="rpl-how" className="mx-auto mt-20 max-w-3xl">
            <Reveal>
              <h3 className="text-center font-display text-2xl font-extrabold text-white">How RPL works here</h3>
            </Reveal>
            <div className="mt-8 space-y-4">
              {[
                { n: '1', t: 'Describe your experience', d: 'Jobs, apprenticeships, self-learning, family business work — in your own words, plus optional evidence documents.' },
                { n: '2', t: 'AI extracts your skills', d: 'Technical skills, tools, processes and knowledge areas — each labeled with a confidence level and what supports it.' },
                { n: '3', t: 'Competency mapping', d: 'Your skills are mapped against your occupation\'s competency framework — demonstrated, partial, or evidence required.' },
                { n: '4', t: 'Adaptive skill assessment', d: 'MCQ, scenario, situational and experience-based questions. Difficulty adapts to your answers. Answer by text or voice.' },
                { n: '5', t: 'Gap analysis + readiness', d: 'A transparent readiness indicator shows what is strong, what needs more evidence, and what to learn next.' },
                { n: '6', t: 'Report + human assessment', d: 'Download an AI-assisted preliminary report and take it to an authorized RPL assessor — the final decision stays human.' },
              ].map((s, i) => (
                <Reveal key={s.n} delay={i * 60}>
                  <div className="sf-card flex items-start gap-4 p-5">
                    <span className="sf-logo-tile flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-extrabold text-white">{s.n}</span>
                    <div>
                      <div className="font-display font-bold text-white">{s.t}</div>
                      <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="sf-strip py-7">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-[13px] text-slate-500 sm:flex-row sm:px-6">
          <span>AI StudyMate — Learn. Test. Adapt. Master. · Now with RPL Skill Assessment: Turn Your Experience Into Recognized Skills.</span>
          <span>It learns from your mistakes and changes how it teaches.</span>
        </div>
      </footer>
    </div>
  );
}
