"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";

export interface MenuAction {
  id: string;
  label: string;
  icon?: IconName;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface MenuSeparator {
  id: string;
  separator: true;
}

export type MenuEntry = MenuAction | MenuSeparator;

interface DropdownMenuProps {
  trigger: ReactNode;
  ariaLabel: string;
  items: MenuEntry[];
  align?: "left" | "right";
  buttonClassName?: string;
  title?: string;
}

const MENU_WIDTH = 212;

export function DropdownMenu({
  trigger,
  ariaLabel,
  items,
  align = "right",
  buttonClassName = "btn-icon",
  title,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const estimatedHeight = items.length * 38 + 14;
    let left = align === "right" ? rect.right - MENU_WIDTH : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));
    let top = rect.bottom + 6;
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 6);
    }
    setPosition({ top, left });
  }, [align, items.length]);

  useEffect(() => {
    if (!open) return;
    place();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onReposition = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, place]);

  useLayoutEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]");
    first?.focus();
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Tab"].includes(event.key)) return;
    const entries = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [],
    );
    if (entries.length === 0) return;
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    event.preventDefault();
    const active = document.activeElement as HTMLButtonElement | null;
    const index = active ? entries.indexOf(active) : -1;
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % entries.length;
    if (event.key === "ArrowUp") nextIndex = (index - 1 + entries.length) % entries.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = entries.length - 1;
    entries[nextIndex]?.focus();
  };

  const choose = (action: MenuAction) => {
    if (action.disabled) return;
    setOpen(false);
    triggerRef.current?.focus();
    action.onSelect();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={buttonClassName}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              className="menu"
              role="menu"
              aria-label={ariaLabel}
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
              onKeyDown={onMenuKeyDown}
            >
              {items.map((entry) =>
                "separator" in entry ? (
                  <div key={entry.id} className="menu-separator" role="separator" />
                ) : (
                  <button
                    key={entry.id}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className={`menu-item ${entry.danger ? "is-danger" : ""}`}
                    disabled={entry.disabled}
                    onClick={() => choose(entry)}
                  >
                    <span className="menu-item-icon">
                      {entry.icon ? <Icon name={entry.icon} size={16} /> : null}
                    </span>
                    <span className="menu-item-label">{entry.label}</span>
                    {entry.shortcut ? (
                      <kbd className="menu-item-shortcut">{entry.shortcut}</kbd>
                    ) : null}
                  </button>
                ),
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
