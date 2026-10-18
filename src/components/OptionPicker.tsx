import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown } from "./Icons";

export interface OptionPickerItem {
  value: string;
  primary: string;
  secondary?: string;
}

type MenuBox = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

function useFloatingMenu(open: boolean, rootRef: React.RefObject<HTMLDivElement | null>) {
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuBox(null);
      return;
    }
    function place() {
      const trigger = rootRef.current?.querySelector<HTMLElement>(".account-picker-trigger");
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
      const spaceAbove = rect.top - gap - 12;
      const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(120, Math.min(280, openUp ? spaceAbove : spaceBelow));
      setMenuBox(
        openUp
          ? { bottom: window.innerHeight - rect.top + gap, left: rect.left, width: rect.width, maxHeight }
          : { top: rect.bottom + gap, left: rect.left, width: rect.width, maxHeight },
      );
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, rootRef]);

  return menuBox;
}

export function OptionPicker({
  options,
  value,
  label,
  placeholder = "Wybierz…",
  wide = false,
  onChange,
}: {
  options: OptionPickerItem[];
  value: string;
  label: string;
  placeholder?: string;
  /** Szerszy trigger — np. długie nazwy zestawów. */
  wide?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const menuBox = useFloatingMenu(open, rootRef);
  const selected = options.find((item) => item.value === value) ?? null;
  const stacked = options.some((item) => item.secondary);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const menu =
    open && menuBox
      ? createPortal(
          <ul
            className={`account-picker-menu${stacked ? " is-stacked" : " is-plain"}`}
            id={listId}
            role="listbox"
            aria-label={label}
            ref={menuRef}
            style={{
              top: menuBox.top,
              bottom: menuBox.bottom,
              left: menuBox.left,
              width: menuBox.width,
              maxHeight: menuBox.maxHeight,
            }}
          >
            {options.map((item) => (
              <li key={item.value} role="option" aria-selected={value === item.value}>
                <button
                  type="button"
                  className={value === item.value ? "is-current" : ""}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  {stacked ? (
                    <>
                      <b>{item.primary}</b>
                      {item.secondary ? <span>{item.secondary}</span> : null}
                    </>
                  ) : (
                    <span>{item.primary}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className={`account-picker${wide ? " is-wide" : ""}${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="account-picker-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        {selected ? (
          stacked ? (
            <span className="account-picker-value is-stacked">
              <b>{selected.primary}</b>
              {selected.secondary ? <span>{selected.secondary}</span> : null}
            </span>
          ) : (
            <span className="account-picker-value is-plain">
              <span>{selected.primary}</span>
            </span>
          )
        ) : (
          <span className="account-picker-placeholder">{placeholder}</span>
        )}
        <IconChevronDown />
      </button>
      {menu}
    </div>
  );
}
