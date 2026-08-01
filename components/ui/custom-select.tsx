"use client";

import { useState, useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomSelectProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  size?: "default" | "sm";
  id?: string;
  ariaLabel?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  icon,
  disabled = false,
  className,
  size = "default",
  id,
  ariaLabel,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId();
  const triggerId = id || `custom-select-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;

  const selectedOption = options.find((o) => o.value === value);

  /* Close on outside click */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* Keyboard navigation */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activeIndex >= 0) {
        onChange(options[activeIndex].value);
        setOpen(false);
        setActiveIndex(-1);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      triggerRef.current?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (e.key === "Tab") {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const selectOption = (value: string) => {
    onChange(value);
    setOpen(false);
    setActiveIndex(-1);
    triggerRef.current?.focus();
  };

  const sizeClasses = size === "sm"
    ? "h-9 rounded-lg text-xs px-3"
    : "h-12 rounded-xl text-sm px-4 pl-11";

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        id={triggerId}
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => {
            if (!current) setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
            return !current;
          });
        }}
        className={cn(
          "flex w-full items-center justify-between border border-border bg-background/50 backdrop-blur",
          "ring-offset-background transition-all duration-200 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/40 focus-visible:bg-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          sizeClasses,
          open && "border-primary/40 ring-2 ring-primary/40 bg-background",
          className
        )}
      >
        <span className={cn("flex items-center gap-2", !selectedOption && "text-muted-foreground/60")}>
          {icon && <span className="flex-shrink-0 text-muted-foreground/50">{icon}</span>}
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground/50 flex-shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-50 left-0 right-0 mt-1.5 overflow-hidden",
              "rounded-xl border border-border bg-card shadow-xl shadow-black/[0.08]",
              size === "sm" ? "rounded-lg" : "rounded-xl"
            )}
            id={listboxId}
            role="listbox"
          >
            <div className={cn("overflow-y-auto scrollbar-thin", size === "sm" ? "max-h-40 py-0.5" : "max-h-48 py-1")}>
              {options.map((option, i) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled}
                  id={`${listboxId}-option-${i}`}
                  role="option"
                  aria-selected={option.value === value}
                  tabIndex={-1}
                  className={cn(
                    "w-full text-left transition-colors duration-100 flex items-center",
                    size === "sm" ? "px-3 py-2 text-xs gap-2" : "px-4 py-2.5 text-sm gap-3",
                    i === activeIndex
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-primary/5",
                    option.value === value && "bg-primary/5 font-medium"
                  )}
                  onMouseDown={(e) => { e.preventDefault(); selectOption(option.value); }}
                  onClick={() => selectOption(option.value)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {option.value === value && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  )}
                  {option.value !== value && option.value === selectedOption?.value && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/30 flex-shrink-0" />
                  )}
                  {option.value !== value && option.value !== selectedOption?.value && (
                    <span className={cn("flex-shrink-0", size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2")} />
                  )}
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
