import type { SVGProps } from "react";

const paths = {
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6L6 18",
  folder:
    "M3 8.5V7a2 2 0 0 1 2-2h3.2l2 2H19a2 2 0 0 1 2 2v1.5M3 8.5h18M3 8.5v8A2.5 2.5 0 0 0 5.5 19h13a2.5 2.5 0 0 0 2.5-2.5v-6",
  "folder-open":
    "M3 9V7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v1M3 9h17.2a1 1 0 0 1 .96 1.28l-1.7 6.1A2.5 2.5 0 0 1 17.05 18H5.5A2.5 2.5 0 0 1 3 15.5z",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  "file-plus":
    "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 12v6M9 15h6",
  "folder-plus":
    "M3 8.5V7a2 2 0 0 1 2-2h3.2l2 2H19a2 2 0 0 1 2 2v1.5M3 8.5v8A2.5 2.5 0 0 0 5.5 19h13a2.5 2.5 0 0 0 2.5-2.5v-6M3 8.5h18M12 11.5v5M9.5 14h5",
  "chevron-right": "m9 6 6 6-6 6",
  "chevron-down": "m6 9 6 6 6-6",
  plus: "M12 5v14M5 12h14",
  search: "M20 20l-4.2-4.2M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z",
  terminal:
    "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM7 9l3 3-3 3M13 15h4",
  settings:
    "M4 7h9M17.5 7H20M4 17h2.5M11 17h9M16 4.8v4.4M8 14.8v4.4",
  "more-horizontal": "M6 12h.01M12 12h.01M18 12h.01",
  "more-vertical": "M12 6v.01M12 12v.01M12 18v.01",
  trash:
    "M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6",
  pencil: "M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17zM13.5 6.5l3 3",
  save: "M5 4h11l3 3v13H5zM8 4v6h7V4M8 20v-6h8v6",
  check: "m5 13 4 4 10-10",
  alert: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 8v5M12 16h.01",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a7 7 0 0 0 10.7 10.7Z",
  refresh:
    "M20 11a8 8 0 1 0-.9 4.5M20 5v6h-6",
  server:
    "M4 4h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM4 14h16a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1ZM7 7h.01M7 17h.01",
  "arrow-up": "M12 19V5M6 11l6-6 6 6",
  "panel-left": "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM9 4v16",
  wrap: "M4 7h16M4 12h11a3 3 0 0 1 0 6h-3M4 17h2M4 22h16",
  code: "m8 6-5 6 5 6M16 6l5 6-5 6",
  keyboard:
    "M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM7 10h.01M11 10h.01M15 10h.01M19 10h.01M8 14h8",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  "arrow-right": "M5 12h14M13 6l6 6-6 6",
  filter: "M4 5h16l-6 7v6l-4 2v-8z",
  power: "M12 3v9M7.5 6.3a8 8 0 1 0 9 0",
  "folder-tree":
    "M3 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM15 9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM15 17a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1zM9 9h4M4 9v9h4M8 18h6",
} as const;

export type IconName = keyof typeof paths;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
