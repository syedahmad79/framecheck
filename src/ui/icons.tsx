import type { ReactNode, SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
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

export const SideBySideIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="1.75" y="2.75" width="5" height="10.5" rx="1" />
    <rect x="9.25" y="2.75" width="5" height="10.5" rx="1" />
  </Icon>
);

export const SliderIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" />
    <path d="M8 1v14M5.5 6.5 4 8l1.5 1.5M10.5 6.5 12 8l-1.5 1.5" />
  </Icon>
);

export const OverlayIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="1.75" y="1.75" width="9" height="9" rx="1.5" />
    <rect x="5.25" y="5.25" width="9" height="9" rx="1.5" />
  </Icon>
);

export const DiffIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="1.5" />
    <path d="M5 5h2v2H5zM9 9h2v2H9zM9 5h.01M5 10.5h.01" />
  </Icon>
);

export const ZoomInIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Icon>
);

export const ZoomOutIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 8h9" />
  </Icon>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13 8H3M7 4 3 8l4 4" />
  </Icon>
);

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 10.5v-8M4.75 5.5 8 2.25l3.25 3.25M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 4.5h11M6 4.5v-2h4v2M4 4.5l.6 8.1a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.1" />
  </Icon>
);

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2 1.75 13h12.5L8 2ZM8 6.5v3M8 11.25h.01" />
  </Icon>
);

export const SwapIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 5.5h11M10.5 2.5l3 3-3 3M13.5 10.5h-11M5.5 7.5l-3 3 3 3" />
  </Icon>
);

export const TargetIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2 5.5V3a1 1 0 0 1 1-1h2.5M10.5 2H13a1 1 0 0 1 1 1v2.5M14 10.5V13a1 1 0 0 1-1 1h-2.5M5.5 14H3a1 1 0 0 1-1-1v-2.5" />
    <circle cx="8" cy="8" r="1.75" />
  </Icon>
);

export function Logo({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect
        x="4"
        y="5"
        width="15"
        height="15"
        rx="2.5"
        fill="none"
        stroke="#6ea8fe"
        strokeWidth="2.5"
      />
      <rect
        x="13"
        y="12"
        width="15"
        height="15"
        rx="2.5"
        fill="none"
        stroke="#ff4d8d"
        strokeWidth="2.5"
      />
    </svg>
  );
}
