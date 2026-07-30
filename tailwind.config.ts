import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // font-sans משמש בכל האתר (ר' app/layout.tsx), אבל בלי המיפוי הזה הוא נופל לגופן
        // ברירת המחדל של הדפדפן/מערכת ההפעלה במקום לגופן Heebo שנטען - זה מה שגרם לגופן
        // המעורב/לא אחיד שנראה בכותרת חנות האפליקציות ובמקומות נוספים באתר.
        sans: ["var(--font-heebo)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        // bg/surface/surface2/border/white/gray-{100..600} מוגדרים כמשתני CSS (ראו app/globals.css)
        // כדי שהחלפת מצב בהיר/כהה תשפיע עליהם בכל האתר בבת אחת. שאר הצבעים (primary/accent/gold
        // וכן כל שאר צבעי ברירת המחדל של Tailwind כמו red) נשארים קבועים בשני המצבים.
        bg: "rgb(var(--c-bg) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        surface2: "rgb(var(--c-surface2) / <alpha-value>)",
        border: "rgb(var(--c-border) / <alpha-value>)",
        white: "rgb(var(--c-white) / <alpha-value>)",
        gray: {
          100: "rgb(var(--c-gray-100) / <alpha-value>)",
          200: "rgb(var(--c-gray-200) / <alpha-value>)",
          300: "rgb(var(--c-gray-300) / <alpha-value>)",
          400: "rgb(var(--c-gray-400) / <alpha-value>)",
          500: "rgb(var(--c-gray-500) / <alpha-value>)",
          600: "rgb(var(--c-gray-600) / <alpha-value>)"
        },
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
