/** Browser text-to-speech for lesson content (accessibility bonus feature). */

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;
  stopSpeaking();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function buildLessonSpeech(
  topic: string,
  summary: string,
  concepts: { title: string; explanation: string }[],
): string {
  const conceptText = concepts.map((c, i) => `Concept ${i + 1}. ${c.title}. ${c.explanation}`).join(' ');
  return `Lesson on ${topic}. ${summary} ${conceptText}`;
}
