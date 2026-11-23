"use client";

import { useActionState, useState } from "react";
import { login, type FormState } from "../actions";
import { IcLock } from "../icons";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="login-form">
      <label htmlFor="password" className="sr-only">
        كلمة المرور
      </label>
      <div className={`pw ${state.message ? "pw-err" : ""}`}>
        <IcLock />
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          placeholder="كلمة المرور"
          dir="ltr"
          required
          autoFocus
          aria-invalid={!!state.message}
          aria-describedby={state.message ? "login-err" : undefined}
        />
        <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-pressed={show}>
          {show ? "إخفاء" : "إظهار"}
        </button>
      </div>
      {state.message && (
        <p className="login-err" id="login-err" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className="a-btn a-btn-primary a-btn-lg" disabled={pending}>
        {pending ? <span className="spinner" aria-hidden /> : null}
        {pending ? "جارٍ الدخول…" : "دخول"}
      </button>
    </form>
  );
}
