"use client";

import { useState, useTransition } from "react";
import { sendTestPush } from "./actions";
import { IcBell } from "./icons";

export function TestPush() {
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="test-push">
      <button
        type="button"
        className="a-btn"
        disabled={pending}
        onClick={() => start(async () => setMsg(await sendTestPush().catch(() => "تعذّر الإرسال. حاول مرة أخرى.")))}
      >
        <IcBell /> {pending ? "جارٍ الإرسال…" : "إرسال إشعار تجريبي"}
      </button>
      {msg && (
        <p className="a-msg" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
