import { useEffect, useState } from "react";

// Design tokens are stored as "R G B" triplets on :root; charts render on the
// client, so we read the live values and re-read whenever the theme (light/dark
// class or data-skin) changes, keeping chart colors in step with the app.

function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `rgb(${v})` : fallback;
}

export type ThemeColors = { brand: string; positive: string; negative: string };

const DEFAULTS: ThemeColors = { brand: "#5850ec", positive: "#16a374", negative: "#e14c60" };

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(DEFAULTS);

  useEffect(() => {
    const update = () =>
      setColors({
        brand: readVar("--brand", DEFAULTS.brand),
        positive: readVar("--positive", DEFAULTS.positive),
        negative: readVar("--negative", DEFAULTS.negative),
      });
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-skin", "style"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", update);
    return () => {
      obs.disconnect();
      mq.removeEventListener?.("change", update);
    };
  }, []);

  return colors;
}
