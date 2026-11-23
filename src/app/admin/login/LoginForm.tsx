"use client";

import { useActionState } from "react";
import { login, type FormState } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="admin-form">
      <div className="a-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          aria-describedby={state.message ? "login-err" : undefined}
        />
      </div>
      {state.message && (
        <p className="a-msg a-msg-err" id="login-err" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className="a-btn a-btn-primary" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
