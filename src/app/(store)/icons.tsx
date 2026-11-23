// Small line icons, drawn to match the feature icons on the Pro Max box.
const common = {
  width: 28,
  height: 28,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const BenefitIcons = [
  // multi-function accessories
  <svg key="a" {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="2.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="2.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="2.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="2.5" /></svg>,
  // storage box
  <svg key="b" {...common}><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V9H3z" /><path d="M9 13h6" /></svg>,
  // safety lock
  <svg key="c" {...common}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><path d="M12 14.5v2.5" /></svg>,
  // big mouth chute
  <svg key="d" {...common}><ellipse cx="12" cy="6" rx="5" ry="2" /><path d="M7 6v6M17 6v6" /><path d="M3.5 14h17l-1.5 5a2 2 0 0 1-1.9 1.4H6.9A2 2 0 0 1 5 19z" /></svg>,
  // non-slip feet
  <svg key="e" {...common}><path d="M5 14a7 7 0 0 1 14 0" /><path d="M3 14h18" /><path d="M7 14v3M12 14v3M17 14v3" /></svg>,
  // efficient cut & chop
  <svg key="f" {...common}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /><path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" /></svg>,
];

export function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function TruckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6.5h11v10h-11z" /><path d="M13.5 10h4l3 3.5v3h-7" /><circle cx="6.5" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" />
    </svg>
  );
}

export function CashIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9.5v5M18 9.5v5" />
    </svg>
  );
}

export function CallIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /><path d="M15 3.5a6 6 0 0 1 5.5 5.5M15 7a2.5 2.5 0 0 1 2 2" />
    </svg>
  );
}
