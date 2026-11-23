import { redirect } from "next/navigation";
import { authConfigProblem, isAdmin } from "@/lib/auth";
import { databaseStatus } from "@/lib/db";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const problem = authConfigProblem();
  const dbs = await databaseStatus();
  const ready = !problem && dbs.ok;
  // Technical details go to the server log only, never on screen.
  if (problem) console.error("admin login unavailable:", problem);
  if (!dbs.ok) console.error("admin login: database unavailable:", dbs.error);

  return (
    <main className="login">
      <div className="login-bg" aria-hidden>
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="grid-floor" />
      </div>

      <div className="login-stage">
        <div className="cube-wrap" aria-hidden>
          <div className="cube">
            <span className="face f-front">P</span>
            <span className="face f-back">MAX</span>
            <span className="face f-right">7×1</span>
            <span className="face f-left">P</span>
            <span className="face f-top" />
            <span className="face f-bottom" />
          </div>
          <span className="cube-shadow" />
        </div>

        <div className="login-card">
          <p className="login-eyebrow">Pro Max</p>
          <h1>لوحة التحكم</h1>
          <p className="login-sub">سجّل الدخول لإدارة الطلبات والمنتج والمتجر.</p>
          {ready ? (
            <LoginForm />
          ) : (
            <p className="login-wait" role="status">
              لوحة التحكم غير متاحة الآن. حاول مرة أخرى بعد قليل.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
