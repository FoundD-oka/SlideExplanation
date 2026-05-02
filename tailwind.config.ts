import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        muted: "#6b7280",
        line: "#e5e7eb",
        panel: "#f8fafc",
        brand: {
          50: "#f3f0ff",
          100: "#ebe4ff",
          500: "#6d4df2",
          600: "#5b36df",
          700: "#4e2ac5"
        }
      },
      boxShadow: {
        phone: "0 24px 80px rgba(15, 23, 42, 0.14)",
        soft: "0 14px 40px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
