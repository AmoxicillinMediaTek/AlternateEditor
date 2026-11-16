import type { Extension } from "@codemirror/state";

export interface EditorLanguage {
  label: string;
  extension: Extension;
}

const PLAIN: EditorLanguage = { label: "Plain text", extension: [] };

const labels: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript JSX",
  mts: "TypeScript",
  cts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript JSX",
  mjs: "JavaScript",
  cjs: "JavaScript",
  json: "JSON",
  jsonc: "JSON",
  html: "HTML",
  htm: "HTML",
  css: "CSS",
  scss: "CSS",
  less: "CSS",
  md: "Markdown",
  markdown: "Markdown",
  mdx: "Markdown",
  py: "Python",
  rs: "Rust",
  java: "Java",
  c: "C",
  h: "C",
  cpp: "C++",
  cc: "C++",
  cxx: "C++",
  hpp: "C++",
  cs: "C#",
  sql: "SQL",
  php: "PHP",
  xml: "XML",
  svg: "XML",
  yml: "YAML",
  yaml: "YAML",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  toml: "TOML",
  env: "Environment",
  txt: "Plain text",
};

export function extensionOf(fileName: string | null): string {
  if (!fileName) return "";
  const clean = fileName.toLowerCase();
  if (clean.startsWith(".env")) return "env";
  const dot = clean.lastIndexOf(".");
  if (dot <= 0) return "";
  return clean.slice(dot + 1);
}

export function labelForFilename(fileName: string | null): string {
  if (!fileName) return "Plain text";
  return labels[extensionOf(fileName)] ?? "Plain text";
}

const loaders: Record<string, () => Promise<Extension>> = {
  ts: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true, jsx: false }),
    ),
  tsx: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true, jsx: true }),
    ),
  mts: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true }),
    ),
  cts: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true }),
    ),
  js: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  jsx: () =>
    import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  mjs: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  cjs: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  jsonc: () => import("@codemirror/lang-json").then((m) => m.json()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  htm: () => import("@codemirror/lang-html").then((m) => m.html()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  scss: () => import("@codemirror/lang-css").then((m) => m.css()),
  less: () => import("@codemirror/lang-css").then((m) => m.css()),
  md: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  mdx: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  py: () => import("@codemirror/lang-python").then((m) => m.python()),
  rs: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  java: () => import("@codemirror/lang-java").then((m) => m.java()),
  c: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  h: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  cc: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  cxx: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  hpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  php: () => import("@codemirror/lang-php").then((m) => m.php()),
  xml: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  svg: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  yml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
};

const cache = new Map<string, Promise<EditorLanguage>>();

export function loadLanguage(fileName: string | null): Promise<EditorLanguage> {
  if (!fileName) return Promise.resolve(PLAIN);
  const ext = extensionOf(fileName);
  const loader = loaders[ext];
  if (!loader) return Promise.resolve(PLAIN);
  const cached = cache.get(ext);
  if (cached) return cached;
  const promise = loader()
    .then((extension) => ({ label: labels[ext] ?? "Plain text", extension }))
    .catch(() => PLAIN);
  cache.set(ext, promise);
  return promise;
}
