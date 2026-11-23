"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { IcTrash } from "./icons";

/** Two-step delete: first tap arms it, second tap (within 4s) deletes. No browser dialogs. */
export function ConfirmDelete() {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  return (
    <button
      type={armed ? "submit" : "button"}
      className={`a-btn a-btn-danger${armed ? " armed" : ""}`}
      disabled={pending}
      onClick={() => {
        if (armed) return;
        setArmed(true);
        setTimeout(() => setArmed(false), 4000);
      }}
    >
      <IcTrash />
      {pending ? "جارٍ الحذف…" : armed ? "اضغط مرة أخرى للتأكيد" : "حذف الطلب"}
    </button>
  );
}
