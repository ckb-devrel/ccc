"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./dropdown.module.css";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  /** Small muted text shown at the right of the option, e.g. a code. */
  hint?: string;
};

export function Dropdown<T extends string>({
  align = "end",
  className,
  icon,
  label,
  onChange,
  options,
  value,
}: {
  /** Which edge of the trigger the menu aligns to. */
  align?: "start" | "end";
  className?: string;
  /** Optional leading icon rendered inside the trigger. */
  icon?: ReactNode;
  /** Accessible name of the control; also used as the tooltip. */
  label: string;
  onChange: (value: T) => void;
  options: readonly DropdownOption<T>[];
  value: T;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const selected = options.find((option) => option.value === value);

  const close = useCallback(() => setOpen(false), []);
  const openMenu = useCallback(() => {
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  }, [options, value]);

  const select = useCallback(
    (index: number) => {
      const option = options[index];
      if (option && option.value !== value) {
        onChange(option.value);
      }
      close();
    },
    [close, onChange, options, value],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [close, open]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          openMenu();
        } else {
          setActive((index) => Math.min(last, index + 1));
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          openMenu();
        } else {
          setActive((index) => Math.max(0, index - 1));
        }
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActive(last);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) {
          select(active);
        } else {
          openMenu();
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      case "Tab":
        close();
        break;
    }
  };

  return (
    <div
      className={`${styles.root} ${open ? styles.isOpen : ""} ${className ?? ""}`}
      ref={rootRef}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        className={styles.trigger}
        title={label}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        onClick={() => (open ? close() : openMenu())}
      >
        {icon}
        <span className={styles.value}>{selected?.label ?? value}</span>
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </button>

      <ul
        id={`${id}-listbox`}
        role="listbox"
        aria-label={label}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        className={`${styles.menu} ${align === "start" ? styles.alignStart : ""}`}
      >
        {options.map((option, index) => {
          const isSelected = option.value === value;
          return (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={isSelected}
              className={`${styles.option} ${isSelected ? styles.isSelected : ""} ${index === active ? styles.isActive : ""}`}
              onPointerMove={() => setActive(index)}
              onClick={() => select(index)}
            >
              <span className={styles.check} aria-hidden="true">
                {isSelected ? <Check /> : null}
              </span>
              <span className={styles.optionLabel}>{option.label}</span>
              {option.hint ? (
                <span className={styles.optionHint}>{option.hint}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
