"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";

interface PromptDialogProps {
  open: boolean;
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  hint?: string;
  confirmLabel: string;
  onClose: () => void;
  onSubmit: (value: string) => { ok: true } | { ok: false; error: string };
}

export function PromptDialog({
  open,
  title,
  label,
  initialValue = "",
  placeholder,
  hint,
  confirmLabel,
  onClose,
  onSubmit,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setError(null);
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      const dot = initialValue.lastIndexOf(".");
      if (dot > 0 && !initialValue.startsWith(".")) {
        inputRef.current?.setSelectionRange(0, dot);
      } else {
        inputRef.current?.select();
      }
    }, 40);
    return () => window.clearTimeout(timer);
  }, [open, initialValue]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = onSubmit(value);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      className="dialog-prompt"
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="prompt-form" className="btn btn-primary">
            {confirmLabel}
          </button>
        </>
      }
    >
      <form id="prompt-form" onSubmit={submit} noValidate>
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          className={`text-input mono ${error ? "has-error" : ""}`}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {error ? (
          <p className="field-error" id={errorId} role="alert">
            {error}
          </p>
        ) : hint ? (
          <p className="field-hint">{hint}</p>
        ) : null}
      </form>
    </Dialog>
  );
}
