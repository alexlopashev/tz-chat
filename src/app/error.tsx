"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>We couldn’t open your workspace.</h1>
      <p>Your connection may be temporarily unavailable. Please try again.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
