"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import type { FormState } from "./actions";

const ErrorsCtx = createContext<Record<string, string>>({});

export function AdminForm({
  action,
  submitLabel,
  children,
  className,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const msgRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.message) msgRef.current?.focus();
  }, [state]);
  return (
    <ErrorsCtx.Provider value={state.errors ?? {}}>
      <form
        action={formAction}
        // Submit manually so React does not reset the fields after saving or on a
        // validation error. Without JS the native form post still works.
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
        className={className ?? "admin-form"}
        noValidate
      >
        {children}
        <div className="form-footer">
          <button type="submit" className="a-btn a-btn-primary" disabled={pending} aria-busy={pending}>
            {pending ? "Saving…" : submitLabel}
          </button>
          {state.message && (
            <p
              ref={msgRef}
              tabIndex={-1}
              role={state.ok ? "status" : "alert"}
              className={state.ok ? "a-msg a-msg-ok" : "a-msg a-msg-err"}
            >
              {state.message}
            </p>
          )}
        </div>
      </form>
    </ErrorsCtx.Provider>
  );
}

export function Field({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  // Children come from server components and may arrive lazily, so they are
  // rendered as-is (never cloned). Pages wire id/name/aria via f(name).
  const errors = useContext(ErrorsCtx);
  const err = errors[name];
  return (
    <div className={err ? "a-field has-err" : "a-field"}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && (
        <p className="a-hint" id={`${name}-hint`}>
          {hint}
        </p>
      )}
      {err && (
        <p className="a-err" id={`${name}-err`}>
          {err}
        </p>
      )}
    </div>
  );
}
