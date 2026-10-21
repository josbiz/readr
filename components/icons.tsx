import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
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

export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
);
export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="6" height="7" rx="1" />
    <rect x="14" y="4" width="6" height="7" rx="1" />
    <rect x="4" y="14" width="6" height="7" rx="1" />
    <rect x="14" y="14" width="6" height="7" rx="1" />
  </Icon>
);
export const ListIcon = (p: IconProps) => <Icon {...p}><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></Icon>;
export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </Icon>
);
export const BackIcon = (p: IconProps) => <Icon {...p}><path d="M15 18l-6-6 6-6" /></Icon>;
export const NextIcon = (p: IconProps) => <Icon {...p}><path d="M9 18l6-6-6-6" /></Icon>;
export const ContentsIcon = (p: IconProps) => <Icon {...p}><path d="M4 6h16M4 12h10M4 18h13" /></Icon>;
export const BookmarksIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 4h11v16l-5.5-4L8 20z" />
    <path d="M5 7v13" />
  </Icon>
);
export const BookmarkIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}><path d="M6 3h12v18l-6-4.5L6 21z" fill={filled ? "currentColor" : "none"} /></Icon>
);
export const TypeIcon = (p: IconProps) => <Icon {...p}><path d="M4 18l4.5-12L13 18M5.7 14h5.6M15 18l3-8 3 8M15.9 15.5h4.2" /></Icon>;
export const ExpandIcon = (p: IconProps) => <Icon {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Icon>;
export const CompressIcon = (p: IconProps) => <Icon {...p}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></Icon>;
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const MinusIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14" /></Icon>;
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
export const TrashIcon = (p: IconProps) => <Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></Icon>;
