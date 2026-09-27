import { RefreshCw, WifiOff } from 'lucide-react';

interface ErrorScreenProps {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}

export default function ErrorScreen({ message, onRetry, onBack }: ErrorScreenProps) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center sm:px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bad-soft">
        <WifiOff className="h-7 w-7 text-bad" aria-hidden="true" />
      </div>
      <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-ink">
        Something interrupted the lesson
      </h1>
      <p className="mt-3 leading-relaxed text-ink-soft">{message}</p>
      <div className="mt-7 flex gap-3">
        <button onClick={onRetry} className="btn btn-primary btn-lg">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try Again
        </button>
        <button onClick={onBack} className="btn btn-ghost btn-lg">
          Back
        </button>
      </div>
    </div>
  );
}
