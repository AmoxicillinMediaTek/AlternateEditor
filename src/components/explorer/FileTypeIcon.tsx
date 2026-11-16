import { extensionOf } from "@/components/editor/languages";

const badges: Record<string, { label: string; tone: string }> = {
  ts: { label: "TS", tone: "blue" },
  mts: { label: "TS", tone: "blue" },
  cts: { label: "TS", tone: "blue" },
  tsx: { label: "TX", tone: "teal" },
  js: { label: "JS", tone: "yellow" },
  mjs: { label: "JS", tone: "yellow" },
  cjs: { label: "JS", tone: "yellow" },
  jsx: { label: "JX", tone: "teal" },
  json: { label: "{}", tone: "yellow" },
  jsonc: { label: "{}", tone: "yellow" },
  html: { label: "<>", tone: "orange" },
  htm: { label: "<>", tone: "orange" },
  xml: { label: "<>", tone: "orange" },
  svg: { label: "<>", tone: "orange" },
  css: { label: "#", tone: "violet" },
  scss: { label: "#", tone: "violet" },
  less: { label: "#", tone: "violet" },
  md: { label: "MD", tone: "grey" },
  markdown: { label: "MD", tone: "grey" },
  mdx: { label: "MD", tone: "grey" },
  py: { label: "PY", tone: "blue" },
  rs: { label: "RS", tone: "orange" },
  java: { label: "JV", tone: "red" },
  c: { label: "C", tone: "blue" },
  h: { label: "C", tone: "blue" },
  cpp: { label: "C+", tone: "blue" },
  cc: { label: "C+", tone: "blue" },
  cxx: { label: "C+", tone: "blue" },
  hpp: { label: "C+", tone: "blue" },
  cs: { label: "C#", tone: "violet" },
  php: { label: "PH", tone: "violet" },
  sql: { label: "SQ", tone: "teal" },
  yml: { label: "Y", tone: "red" },
  yaml: { label: "Y", tone: "red" },
  sh: { label: "$", tone: "green" },
  bash: { label: "$", tone: "green" },
  zsh: { label: "$", tone: "green" },
  toml: { label: "T", tone: "grey" },
  env: { label: "EN", tone: "grey" },
  gitignore: { label: "GI", tone: "grey" },
};

export function FileTypeIcon({
  name,
  kind,
  expanded = false,
}: {
  name: string;
  kind: "file" | "folder";
  expanded?: boolean;
}) {
  if (kind === "folder") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="file-icon folder-icon"
        width={18}
        height={18}
        aria-hidden="true"
      >
        {expanded ? (
          <path
            d="M3 9.2V7a2 2 0 0 1 2-2h3.4l2 2H19a2 2 0 0 1 2 2v.2M3.4 8.8h17.2a.9.9 0 0 1 .87 1.13l-1.6 6.35A2.4 2.4 0 0 1 17.6 18H5.4A2.4 2.4 0 0 1 3 15.6z"
            fill="currentColor"
            fillOpacity={0.18}
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M3 8V6.8A1.8 1.8 0 0 1 4.8 5h3.4l2 2h8A1.8 1.8 0 0 1 20 8.8V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            fill="currentColor"
            fillOpacity={0.16}
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        )}
      </svg>
    );
  }

  const ext = name.startsWith(".") ? name.slice(1).toLowerCase() : extensionOf(name);
  const badge = badges[ext];
  if (badge) {
    return (
      <span className={`file-icon file-badge tone-${badge.tone}`} aria-hidden="true">
        {badge.label}
      </span>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="file-icon" width={18} height={18} aria-hidden="true">
      <path
        d="M13.5 3H7a1.8 1.8 0 0 0-1.8 1.8v14.4A1.8 1.8 0 0 0 7 21h10a1.8 1.8 0 0 0 1.8-1.8V8.3zM13.5 3v5.3h5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}
