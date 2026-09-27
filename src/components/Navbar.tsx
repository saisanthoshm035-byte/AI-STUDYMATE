import { AiBadge, Logo } from './ui';
import type { AiStatus } from '../types';

interface NavbarProps {
  status: AiStatus | null;
  onStartLearning: () => void;
  onGoHome: () => void;
  onGoProgress: () => void;
}

export default function Navbar({ status, onStartLearning, onGoHome, onGoProgress }: NavbarProps) {
  const scrollTo = (id: string) => {
    onGoHome();
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60);
  };

  return (
    <header className="sf-nav sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <button onClick={onGoHome} className="shrink-0" aria-label="AI StudyMate home">
          <Logo />
        </button>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {['Learn', 'Progress', 'How It Works'].map((label) => (
            <button
              key={label}
              onClick={() => (label === 'Learn' ? onStartLearning() : label === 'Progress' ? onGoProgress() : scrollTo('how-it-works'))}
              className="sf-navlink rounded-lg px-3 py-2 text-sm font-medium"
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <AiBadge status={status} className="hidden sm:inline-flex" />
          <button onClick={onStartLearning} className="btn sf-btn-primary btn-md">
            Start Learning
          </button>
        </div>
      </div>
    </header>
  );
}
