"use client";

import { useId, type ReactNode } from "react";
import { LOCALE_NAMES, useI18n } from "@/lib/i18n";
import { LOCALES, updateSettings, type Locale, type Theme } from "@/lib/settings";
import { useSettings } from "@/lib/use-settings";

export function Splash({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg text-muted" role="status">
      <span className="font-serif text-lg tracking-wide">{label ?? "readr"}</span>
    </div>
  );
}

export function IconButton({
  label,
  children,
  pressed,
  className = "",
  ...props
}: {
  label: string;
  children: ReactNode;
  pressed?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "aria-pressed">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-ink transition-colors hover:bg-line disabled:opacity-35 disabled:hover:bg-transparent ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** A labelled group of mutually exclusive choices (radio semantics). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-xl bg-line/60 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-sm text-ink has-[:checked]:bg-paper has-[:checked]:shadow-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
            title={option.icon ? option.label : undefined}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon}
            <span className={option.icon ? "sr-only" : undefined}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A labelled dropdown, for choices too many to fit a `Segmented` control. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col">
      <label htmlFor={id} className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-11 rounded-xl border border-line bg-line/60 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const SWATCH: Record<Exclude<Theme, "system">, string> = {
  light: "#fdfcf8",
  sepia: "#f5ecd7",
  dark: "#1c1b19",
};

/** Theme and language: shared by the library settings and the reader display panel. */
export function AppearanceControls() {
  const { t, locale } = useI18n();
  const { theme } = useSettings();
  const swatch = (value: Theme) =>
    value === "system" ? (
      <span
        className="size-4 rounded-full border border-line"
        style={{ background: `linear-gradient(135deg, ${SWATCH.light} 50%, ${SWATCH.dark} 50%)` }}
      />
    ) : (
      <span className="size-4 rounded-full border border-line" style={{ background: SWATCH[value] }} />
    );
  return (
    <div className="flex flex-col gap-5">
      <Segmented<Theme>
        label={t("settings.theme")}
        value={theme}
        onChange={(value) => updateSettings({ theme: value })}
        options={(["system", "light", "sepia", "dark"] as const).map((value) => ({
          value,
          label: t(`settings.theme${value[0].toUpperCase()}${value.slice(1)}` as "settings.themeLight"),
          icon: swatch(value),
        }))}
      />
      <Select<Locale>
        label={t("settings.language")}
        value={locale}
        onChange={(value) => updateSettings({ locale: value })}
        options={LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
      />
    </div>
  );
}
