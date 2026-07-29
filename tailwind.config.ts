import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0a0b10",
        surface: "#12141c",
        surface2: "#191c27",
        border: "#242838",
        primary: { DEFAULT: "#7c5cff", light: "#a78bff", dark: "#5b3df0" },
        accent: "#00d9c0",
        gold: "#f2b84b"
      },
      backgroundImage: {
        "radial-fade": "radial-gradient(circle at 50% 0%, rgba(124,92,255,0.18), transparent 60%)",
        "grid-glow": "linear-gradient(to bottom, rgba(124,92,255,0.08), transparent)"
      },
      boxShadow: {
        glow: "0 0 40px rgba(124,92,255,0.25)",
        card: "0 8px 30px rgba(0,0,0,0.4)"
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite"
      }
    }
  },
  plugins: []
};
export default config;
