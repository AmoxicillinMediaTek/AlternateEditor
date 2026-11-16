import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { WorkspaceProvider } from "@/lib/workspace/store";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "AlternateEditorDemo — mobile code editor",
  description:
    "A mobile-first workspace with a CodeMirror editor, file tree, tabs, workspace search and an in-browser Node terminal.",
  applicationName: "AlternateEditorDemo",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0e11" },
    { media: "(prefers-color-scheme: light)", color: "#eef0f2" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
