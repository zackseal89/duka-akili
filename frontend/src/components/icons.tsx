import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** The Duka Akili mark: a shop awning over an open book. */
export function DukaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        fill="var(--brand)"
      />
      <path
        d="M6.5 10.5h19l-1.6 3.2a2.6 2.6 0 0 1-2.3 1.4H10.4a2.6 2.6 0 0 1-2.3-1.4L6.5 10.5Z"
        fill="var(--accent)"
      />
      <path
        d="M12.6 10.5 11.4 15M19.4 10.5l1.2 4.5"
        stroke="var(--brand)"
        strokeWidth="1.1"
        opacity="0.55"
      />
      <path
        d="M16 18.6c-1.5-1.15-3.2-1.5-5.4-1.35v6.6c2.2-.15 3.9.2 5.4 1.35 1.5-1.15 3.2-1.5 5.4-1.35v-6.6c-2.2-.15-3.9.2-5.4 1.35Z"
        fill="#fff"
        opacity="0.94"
      />
      <path d="M16 18.6v6.6" stroke="var(--brand)" strokeWidth="1.1" opacity="0.5" />
    </svg>
  );
}

export const SearchIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Base>
);

export const CheckIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Base>
);

export const AlertIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3.6 21.4 20H2.6L12 3.6Z" />
    <path d="M12 10v4.2" />
    <path d="M12 17.3h.01" />
  </Base>
);

export const ScaleIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 4v16" />
    <path d="M6 7.5h12" />
    <path d="M6 7.5 3 14.5h6L6 7.5Z" />
    <path d="M18 7.5 15 14.5h6L18 7.5Z" />
    <path d="M8.5 20h7" />
  </Base>
);

export const DocIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 3h8l4.5 4.5V21H6V3Z" />
    <path d="M14 3v4.5h4.5" />
    <path d="M9 13h6M9 16.5h4" />
  </Base>
);

export const SendIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4.5 12h13" />
    <path d="m12.5 6.5 6 5.5-6 5.5" />
  </Base>
);

export const StopIcon = (props: IconProps) => (
  <Base {...props}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2.2" fill="currentColor" stroke="none" />
  </Base>
);

export const RefreshIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 11a8 8 0 1 0-.6 4" />
    <path d="M20 5.5V11h-5.5" />
  </Base>
);

export const PlusIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Base>
);

export const SunIcon = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.8v2.1M12 19.1v2.1M4.3 4.3l1.5 1.5M18.2 18.2l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.3 19.7l1.5-1.5M18.2 5.8l1.5-1.5" />
  </Base>
);

export const MoonIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
  </Base>
);

export const BookIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H19v15.5H6.2A2.2 2.2 0 0 0 4 20.7V5.2Z" />
    <path d="M4 20.7A2.2 2.2 0 0 1 6.2 18.5H19V21H6.2A2.2 2.2 0 0 1 4 20.7Z" />
  </Base>
);

export const ChevronIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m8.5 5.5 7 6.5-7 6.5" />
  </Base>
);

export const CloseIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
);

export const MenuIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
);

export const SparkIcon = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
    <path d="M18.5 15.5 19.2 18l2.3.8-2.3.8-.7 2.4-.7-2.4-2.3-.8 2.3-.8.7-2.5Z" />
  </Base>
);
