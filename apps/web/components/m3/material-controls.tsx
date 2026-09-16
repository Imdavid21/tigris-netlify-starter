"use client";

import { createElement, useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useMaterialWebReady } from "@/components/material-web-provider";
import { motionSpring } from "@/lib/motion-system";

type ChangeEventLike = { target: { value: string; checked?: boolean } };

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (event: ChangeEventLike) => void;
  placeholder?: string;
  type?: string;
  inputMode?: string;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  supportingText?: string;
  errorText?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
};

export function MaterialTextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  required,
  disabled,
  maxLength,
  supportingText,
  errorText,
  multiline,
  rows,
  className = ""
}: TextFieldProps) {
  const ready = useMaterialWebReady();

  if (!ready) {
    return (
      <label className={className}>
        <span>{label}</span>
        {multiline ? (
          <textarea
            value={value}
            onChange={onChange as any}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            maxLength={maxLength}
            rows={rows}
          />
        ) : (
          <input
            value={value}
            onChange={onChange as any}
            placeholder={placeholder}
            type={type}
            inputMode={inputMode as any}
            required={required}
            disabled={disabled}
            maxLength={maxLength}
          />
        )}
        {(errorText || supportingText) && <small>{errorText || supportingText}</small>}
      </label>
    );
  }

  return createElement("md-filled-text-field", {
    className,
    label,
    value,
    placeholder,
    type: multiline ? "textarea" : type,
    inputMode,
    required,
    disabled,
    maxLength,
    supportingText: errorText || supportingText,
    error: Boolean(errorText),
    rows: multiline ? rows ?? 3 : undefined,
    onInput: (event: any) => onChange({ target: { value: String(event.currentTarget.value ?? "") } })
  });
}

type SelectOption = { value: string; label: string };

export function MaterialSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
}) {
  const ready = useMaterialWebReady();

  if (!ready) {
    return (
      <label className={className}>
        <span>{label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    );
  }

  return createElement(
    "md-filled-select",
    {
      className,
      label,
      value,
      disabled,
      onChange: (event: any) => onChange(String(event.currentTarget.value ?? ""))
    },
    ...options.map((option) => createElement("md-select-option", { key: option.value, value: option.value }, option.label))
  );
}

export function MaterialSwitch({
  selected,
  onChange,
  label,
  disabled = false,
  className = ""
}: {
  selected: boolean;
  onChange: (selected: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const ready = useMaterialWebReady();

  return (
    <label className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "default" : "pointer" }}>
      {ready
        ? createElement("md-switch", {
            selected,
            disabled,
            "aria-label": label,
            onChange: (event: any) => onChange(Boolean(event.currentTarget.selected))
          })
        : <input type="checkbox" checked={selected} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />}
      <span>{label}</span>
    </label>
  );
}

export function MaterialSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  disabled = false,
  className = ""
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const ready = useMaterialWebReady();

  if (ready) {
    return createElement("md-slider", {
      className,
      value,
      min,
      max,
      step,
      disabled,
      labeled: true,
      "aria-label": label,
      onInput: (event: any) => onChange(Number(event.currentTarget.value))
    });
  }

  return <input className={className} type="range" value={value} min={min} max={max} step={step} disabled={disabled} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />;
}

export function MaterialCheckbox({
  checked,
  onChange,
  label,
  disabled = false,
  className = ""
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const ready = useMaterialWebReady();
  return (
    <label className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {ready
        ? createElement("md-checkbox", {
            checked,
            disabled,
            "aria-label": label,
            onChange: (event: any) => onChange(Boolean(event.currentTarget.checked))
          })
        : <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />}
      <span>{label}</span>
    </label>
  );
}

export function MaterialDialog({
  open,
  onClose,
  headline,
  children,
  actions
}: {
  open: boolean;
  onClose: () => void;
  headline: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const ready = useMaterialWebReady();
  const dialogRef = useRef<any>(null);

  useEffect(() => {
    if (!ready || !dialogRef.current) return;
    if (open) dialogRef.current.show?.();
    else dialogRef.current.close?.();
  }, [open, ready]);

  if (ready) {
    return createElement(
      "md-dialog",
      {
        ref: dialogRef,
        onClose,
        onCancel: onClose
      },
      createElement("div", { slot: "headline" }, headline),
      createElement("div", { slot: "content" }, children),
      actions ? createElement("div", { slot: "actions" }, actions) : null
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          onMouseDown={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionSpring.effectsFast}
          style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", background: "rgba(0,0,0,.42)", padding: 24 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={motionSpring.spatialDefault}
            style={{ width: "min(560px, 100%)", borderRadius: 28, padding: 24, background: "var(--md-sys-color-surface-container-high)", color: "var(--md-sys-color-on-surface)", boxShadow: "var(--md-sys-elevation-level3)" }}
          >
            <h2>{headline}</h2>
            <div>{children}</div>
            {actions && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>{actions}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
