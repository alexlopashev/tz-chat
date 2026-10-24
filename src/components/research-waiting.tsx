"use client";
import { useEffect, useState } from "react";
const messages = {
  preparing: [
    "Preparing your research…",
    "Reviewing your question…",
    "Getting ready…",
  ],
  retrieving: [
    "Checking RCP sources…",
    "Retrieving polling data…",
    "Waiting for RCP…",
  ],
  reviewing: [
    "Reviewing the evidence…",
    "Checking dates and sources…",
    "Preparing your answer…",
  ],
  writing: ["Writing your answer…", "Putting the findings together…"],
};
export function ResearchWaiting({ phase }: { phase: keyof typeof messages }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((value) => value + 1), 2800);
    return () => clearInterval(timer);
  }, []);
  return (
    <div
      className="research-waiting"
      role="status"
      aria-label="Research in progress"
    >
      <span className="waiting-orbit" aria-hidden="true">
        ✦
      </span>
      <span
        className="waiting-copy"
        aria-hidden="true"
        key={`${phase}-${step}`}
      >
        {messages[phase][step % messages[phase].length]}
      </span>
      <span className="sr-only">
        Your response is in progress. You can stop it at any time.
      </span>
      <span className="waiting-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
