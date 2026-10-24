import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/session";
import { SiteHeader } from "@/components/site-header";
import { SignInForm } from "@/components/sign-in-form";

export default async function SignIn() {
  if (await currentSession()) redirect("/");
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="sign-in-layout">
        <section className="sign-in-story" aria-labelledby="welcome-title">
          <span className="section-label">Sources first. Context always.</span>
          <h1 id="welcome-title">
            A clearer view <br />
            of the race.
          </h1>
          <p className="intro">
            Bring your RCP access to a research space that keeps your questions
            and conversations together.
          </p>
          <div className="story-rule" />
          <p className="story-caption">Your account. Your research.</p>
          <p className="story-detail">
            Return to the same history when you sign in again—even with a new
            token from the same RCP account.
          </p>
        </section>
        <section className="sign-in-card" aria-labelledby="sign-in-title">
          <span className="section-label">Welcome to the polling desk</span>
          <h2 id="sign-in-title">Connect your RCP account</h2>
          <p className="card-intro">
            Use your RCP MCP token to sign in. No separate password to remember.
          </p>
          <ol className="sign-in-steps">
            <li>
              <span className="step-number" aria-hidden="true">
                01
              </span>
              <div>
                <strong>Sign in to RealClearPolitics</strong>
                <p>
                  <a
                    href="https://www.realclearpolitics.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open RealClearPolitics ↗
                  </a>{" "}
                  and sign in to your account.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number" aria-hidden="true">
                02
              </span>
              <div>
                <strong>Copy your MCP token</strong>
                <p>
                  Open the{" "}
                  <a
                    href="https://rcp.tazalabs.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    RCP connection page ↗
                  </a>{" "}
                  and copy the token supplied for connecting an AI app. If
                  access isn’t available, contact RCP.
                </p>
              </div>
            </li>
            <li>
              <span className="step-number" aria-hidden="true">
                03
              </span>
              <div>
                <strong>Connect below</strong>
                <p>
                  We’ll verify your token with RCP and open your research
                  history.
                </p>
              </div>
            </li>
          </ol>
          <SignInForm />
        </section>
      </main>
      <footer>
        Research prototype · Not an official RealClear product · RCP records
        tool calls and their stated purpose.
      </footer>
    </div>
  );
}
