import { redirect } from "next/navigation";
import { authConfigProblem, isAdmin } from "@/lib/auth";
import { databaseStatus } from "@/lib/db";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const problem = authConfigProblem();
  const dbs = await databaseStatus();
  return (
    <main className="login">
      <div className="login-card">
        <h1>Store admin</h1>
        {!dbs.ok && (
          <div className="a-msg a-msg-err" role="alert">
            <p>
              <strong>Database not connected.</strong> {dbs.error}
            </p>
          </div>
        )}
        {problem ? (
          <div className="a-msg a-msg-err" role="alert">
            <p>
              <strong>Admin sign-in is not set up yet.</strong> {problem}
            </p>
            <p>See “Admin sign-in” in the README for the two environment variables to add.</p>
          </div>
        ) : dbs.ok ? (
          <LoginForm />
        ) : null}
      </div>
    </main>
  );
}
