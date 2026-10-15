import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '"Inter"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        serif: [
          '"Instrument Serif"',
          '"Newsreader"',
          '"Playfair Display"',
          "Georgia",
          "Cambria",
          '"Times New Roman"',
          "serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        canvas: {
          DEFAULT: "#F7F5F0",
          sidebar: "#EAE5DC",
          warm: "#F3EFE6",
          muted: "#EFECE4",
          border: "#E6E1D6",
        },
        ink: {
          DEFAULT: "#141413",
          muted: "#6B6860",
          subtle: "#9A968C",
        },
        lime: {
          neon: "#9FE830",
          soft: "#E9F9CD",
        },
        violet: {
          brand: "#7C3AED",
          deep: "#6D28D9",
          soft: "#F3EEFF",
        },
      },
      boxShadow: {
        shell:
          "0 28px 80px -16px rgba(20, 20, 19, 0.16), 0 4px 20px -2px rgba(20, 20, 19, 0.06)",
        card: "0 2px 12px -2px rgba(20, 20, 19, 0.04), 0 1px 3px 0 rgba(20, 20, 19, 0.02)",
        pill: "0 1px 3px 0 rgba(20, 20, 19, 0.04)",
        float:
          "0 14px 34px -6px rgba(20, 20, 19, 0.12), 0 4px 10px -2px rgba(20, 20, 19, 0.05)",
      },
    },
  },
  plugins: [],
} satisfies Config;
