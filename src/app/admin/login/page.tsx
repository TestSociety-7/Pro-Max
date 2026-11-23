import { redirect } from "next/navigation";
import { authConfigProblem, isAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const problem = authConfigProblem();
  return (
    <main className="login">
      <div className="login-card">
        <h1>Store admin</h1>
        {problem ? (
          <div className="a-msg a-msg-err" role="alert">
            <p>
              <strong>Admin sign-in is not set up yet.</strong> {problem}
            </p>
            <p>See “Admin sign-in” in the README for the two environment variables to add.</p>
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
    </main>
  );
}
