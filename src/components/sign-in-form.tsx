"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function SignInForm() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: input.current?.value }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Sign-in failed. Try again.");
        return;
      }
      if (input.current) input.current.value = "";
      router.replace("/");
      router.refresh();
    } catch {
      setError("Couldn't connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="sign-in-form">
      <label htmlFor="rcp-token">Your RCP MCP token</label>
      <div className="token-input">
        <input
          ref={input}
          id="rcp-token"
          name="token"
          type={visible ? "text" : "password"}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={8192}
          disabled={busy}
          placeholder="Paste your token here"
          aria-describedby="token-help sign-in-error"
        />
        <button
          type="button"
          className="text-button"
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? "Hide" : "Show"}
          <span className="sr-only"> token</span>
        </button>
      </div>
      <p id="token-help" className="field-help">
        Paste the token as copied. A “Bearer” prefix is accepted.
      </p>
      <p id="sign-in-error" className="form-error" role="alert">
        {error}
      </p>
      <button className="primary-button" disabled={busy} type="submit">
        {busy ? "Verifying your account…" : "Connect and continue"}
        <span aria-hidden="true">{busy ? "" : " →"}</span>
      </button>
      <p className="privacy-note">
        Your token is encrypted on our server. This browser stays signed in for
        30 days, or until you sign out.
      </p>
    </form>
  );
}
