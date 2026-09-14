import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#14131A",
          soft: "#3D3A47",
          muted: "#7A7788",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          sunken: "#F7F7FB",
          raised: "#FFFFFF",
        },
        border: {
          DEFAULT: "#E5E4ED",
          strong: "#D2D0DF",
        },
        brand: {
          50: "#F0F5FF",
          100: "#DEEAFF",
          200: "#BBD4FF",
          300: "#8FB6FF",
          400: "#5C90F5",
          500: "#3568E0",
          600: "#264FBF",
          700: "#1E3E99",
          800: "#1A337A",
          900: "#182C63",
        },
        score: {
          high: "#1D9A6C",
          "high-bg": "#E5F6EE",
          mid: "#B8860F",
          "mid-bg": "#FBF0DF",
          low: "#7A7788",
          "low-bg": "#F1EFF6",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(20, 19, 26, 0.04), 0 8px 24px -12px rgba(20, 19, 26, 0.12)",
      },
      maxWidth: {
        content: "1180px",
      },
    },
  },
  plugins: [],
};

export default config;
