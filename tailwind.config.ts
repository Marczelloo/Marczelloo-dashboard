import type { Config } from "tailwindcss";

const rgb = (token: string) => `rgb(var(--${token}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/pages/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}", "./src/app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: rgb("canvas"),
        surface: { DEFAULT: rgb("surface"), raised: rgb("surface-raised"), hover: rgb("surface-hover") },
        fg: { DEFAULT: rgb("fg"), 2: rgb("fg-2"), 3: rgb("fg-3"), 4: rgb("fg-4") },
        accent: { DEFAULT: rgb("accent"), solid: rgb("accent-solid"), "solid-hover": rgb("accent-solid-hover"), text: rgb("accent-text"), foreground: "#ffffff" },
        ok: rgb("ok"),
        warn: rgb("warn"),
        err: rgb("err"),
        line: { DEFAULT: "var(--line)", subtle: "var(--line-subtle)", strong: "var(--line-strong)" },
      },
      borderRadius: { xs: "4px", sm: "6px", md: "8px", lg: "10px", xl: "14px" },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        "inset-top": "inset 0 1px 0 rgba(255,255,255,.045)",
        lift: "0 6px 18px -8px rgba(0,0,0,.6)",
        overlay: "0 16px 40px -12px rgba(0,0,0,.7), 0 4px 12px -4px rgba(0,0,0,.5)",
      },
      backgroundImage: { sheen: "var(--sheen)" },
      transitionDuration: { instant: "90ms", quick: "140ms", base: "200ms", panel: "260ms", layout: "420ms" },
      transitionTimingFunction: { out: "var(--ease-out)", "in-out": "var(--ease-inout)", spring: "var(--ease-spring)" },
      keyframes: {
        live: { "0%": { transform: "scale(1)", opacity: "0.7" }, "100%": { transform: "scale(3.2)", opacity: "0" } },
        shimmer: { "0%": { backgroundPosition: "100% 0" }, "100%": { backgroundPosition: "-50% 0" } },
        "overlay-in": { "0%": { opacity: "0", scale: "0.97" }, "100%": { opacity: "1", scale: "1" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "drawer-in": { "0%": { translate: "-100% 0" }, "100%": { translate: "0 0" } },
      },
      animation: {
        live: "live 1.8s var(--ease-out) infinite",
        shimmer: "shimmer 1.6s var(--ease-inout) infinite",
        "overlay-in": "overlay-in 260ms var(--ease-out)",
        "fade-in": "fade-in 200ms var(--ease-out)",
        "drawer-in": "drawer-in 260ms var(--ease-out)",
      },
    },
  },
  plugins: [],
};

export default config;
