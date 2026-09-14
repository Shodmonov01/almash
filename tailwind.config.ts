import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        forest: {
          DEFAULT: "#1a5f4a",
          deep: "#0f3d31",
        },
        coral: "#e85d4c",
        cream: "#f7faf8",
        mist: "#d8ebe3",
        ink: "#1c2b26",
        sand: "#f0e6d8",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        softpulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
      animation: {
        rise: "rise 0.6s ease-out both",
        softpulse: "softpulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
