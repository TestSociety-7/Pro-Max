"use client";

import { useActionState, useState } from "react";
import { login, type FormState } from "../actions";
import { IcLock } from "../icons";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="login-form">
      {/* bots fill every field; people never see this one */}
      <input
        type="text"
        name="username_hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", insetInlineStart: -9999 }}
      />
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
