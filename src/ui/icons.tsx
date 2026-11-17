import type { ReactNode, SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
      {...props}
    >
      {children}
    </svg>
  );
}

const icon = (paths: ReactNode) =>
  function PathIcon(props: IconProps) {
    return <Icon {...props}>{paths}</Icon>;
  };

export const SideBySideIcon = icon(
  <>
    <rect x="1.75" y="2.75" width="5.25" height="10.5" rx="1.25" />
    <rect x="9" y="2.75" width="5.25" height="10.5" rx="1.25" />
  </>,
);
export const SliderIcon = icon(
  <>
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" />
    <path d="M8 1.5v13M5.25 6.5 3.75 8l1.5 1.5M10.75 6.5 12.25 8l-1.5 1.5" />
  </>,
);
export const OverlayIcon = icon(
  <>
    <rect x="1.75" y="1.75" width="9" height="9" rx="1.5" />
    <rect x="5.25" y="5.25" width="9" height="9" rx="1.5" />
  </>,
);
export const DiffIcon = icon(
  <>
    <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2" />
    <path d="M5 8h6M8 5v6" />
  </>,
);
export const ZoomInIcon = icon(<path d="M8 3.5v9M3.5 8h9" />);
export const ZoomOutIcon = icon(<path d="M3.5 8h9" />);
export const FitIcon = icon(
  <>
    <path d="M2 5.5V3.5A1.5 1.5 0 0 1 3.5 2h2M10.5 2h2A1.5 1.5 0 0 1 14 3.5v2M14 10.5v2a1.5 1.5 0 0 1-1.5 1.5h-2M5.5 14h-2A1.5 1.5 0 0 1 2 12.5v-2" />
    <rect x="5.5" y="5.5" width="5" height="5" rx="1" />
  </>,
);
export const ArrowLeftIcon = icon(<path d="M13 8H3M7 4 3 8l4 4" />);
export const UploadIcon = icon(
  <path d="M8 10.5v-8M4.75 5.5 8 2.25l3.25 3.25M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" />,
);
export const TrashIcon = icon(
  <path d="M2.5 4.5h11M6 4.5v-2h4v2M4 4.5l.6 8.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.1" />,
);
export const AlertIcon = icon(<path d="M8 2 1.75 13h12.5L8 2ZM8 6.5v3M8 11.25h.01" />);
export const SwapIcon = icon(
  <path d="M2.5 5.5h11M10.5 2.5l3 3-3 3M13.5 10.5h-11M5.5 7.5l-3 3 3 3" />,
);
export const TargetIcon = icon(
  <>
    <path d="M2 5.5V3.5A1.5 1.5 0 0 1 3.5 2h2M10.5 2h2A1.5 1.5 0 0 1 14 3.5v2M14 10.5v2a1.5 1.5 0 0 1-1.5 1.5h-2M5.5 14h-2A1.5 1.5 0 0 1 2 12.5v-2" />
    <circle cx="8" cy="8" r="1.75" />
  </>,
);
export const SunIcon = icon(
  <>
    <circle cx="8" cy="8" r="2.75" />
    <path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9" />
  </>,
);
export const MoonIcon = icon(
  <path d="M13.25 9.4A5.6 5.6 0 1 1 6.6 2.75a4.5 4.5 0 0 0 6.65 6.65Z" />,
);
export const MonitorIcon = icon(
  <>
    <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.5" />
    <path d="M5.5 13.5h5M8 11.5v2" />
  </>,
);
export const InspectorIcon = icon(
  <>
    <rect x="1.75" y="2.5" width="12.5" height="11" rx="1.75" />
    <path d="M10 2.5v11" />
  </>,
);
export const KeyboardIcon = icon(
  <>
    <rect x="1.5" y="3.75" width="13" height="8.5" rx="1.75" />
    <path d="M4.5 6.75h.01M7 6.75h.01M9.5 6.75h.01M12 6.75h.01M5 9.5h6" />
  </>,
);
export const HistoryIcon = icon(
  <>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 4.75V8l2.25 1.5" />
  </>,
);
export const CheckIcon = icon(<path d="M3.25 8.5 6.5 11.75l6.25-7.5" />);
export const CloseIcon = icon(<path d="M4 4l8 8M12 4l-8 8" />);
export const InfoIcon = icon(
  <>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 7.25v3.5M8 5.15h.01" />
  </>,
);
export const PlusIcon = icon(<path d="M8 3v10M3 8h10" />);
export const LockIcon = icon(
  <>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </>,
);
export const ImageIcon = icon(
  <>
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.75" />
    <circle cx="5.5" cy="6.25" r="1" />
    <path d="m2.5 11.5 3.25-3 2.5 2.25 2-1.75 3.25 2.5" />
  </>,
);
export const ChevronRightIcon = icon(<path d="m6 3.75 4.25 4.25L6 12.25" />);

/** Two offset frames: the reference in blue, the implementation in orange. */
export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="2.75"
        y="2.75"
        width="12.5"
        height="12.5"
        rx="3"
        stroke="var(--ref)"
        strokeWidth="2"
      />
      <rect
        x="8.75"
        y="8.75"
        width="12.5"
        height="12.5"
        rx="3"
        stroke="var(--impl)"
        strokeWidth="2"
      />
    </svg>
  );
}
