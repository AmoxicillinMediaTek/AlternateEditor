"use client";

import { Icon } from "@/components/ui/Icon";

export type SidebarView = "files" | "search" | "settings";

interface SidebarRailProps {
  view: SidebarView;
  onSelect: (view: SidebarView) => void;
}

const ITEMS: Array<{ id: SidebarView; label: string; icon: "folder-tree" | "search" | "settings" }> = [
  { id: "files", label: "Files", icon: "folder-tree" },
  { id: "search", label: "Search", icon: "search" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function SidebarRail({ view, onSelect }: SidebarRailProps) {
  return (
    <nav className="side-rail" aria-label="Sidebar tools">
      {ITEMS.map((item) => {
        const active = item.id === view;
        return (
          <button
            key={item.id}
            type="button"
            className={`rail-item ${active ? "is-active" : ""}`}
            onClick={() => onSelect(item.id)}
            aria-label={item.label}
            aria-pressed={active}
            title={item.label}
          >
            <Icon name={item.icon} size={18} />
          </button>
        );
      })}
    </nav>
  );
}
