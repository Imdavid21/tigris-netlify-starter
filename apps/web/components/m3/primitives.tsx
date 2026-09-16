import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./M3.module.css";

type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "elevated";

type M3ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export function M3Button({
  variant = "filled",
  leadingIcon,
  trailingIcon,
  className = "",
  children,
  ...props
}: M3ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${className}`.trim()}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

export function M3IconButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${styles.iconButton} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

type M3ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
};

export function M3Chip({
  selected = false,
  className = "",
  children,
  ...props
}: M3ChipProps) {
  return (
    <button
      className={`${styles.chip} ${selected ? styles.selected : ""} ${className}`.trim()}
      aria-pressed={selected}
      {...props}
    >
      {selected && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}
