import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        atlas: {
          paper: "#f2f0e9",
          ink: "#111111",
          rule: "#2f2f2f",
          soft: "#d8d5cb",
          muted: "#77746b",
          amber: "#b9851f",
          cyan: "#4fb2c4",
          red: "#9d2b2b",
          green: "#3f7f4a",
          bluegray: "#607283",
          purplegray: "#77667d",
          ruin: "#3c3c3c"
        }
      },
      fontFamily: {
        mono: [
          "IBM Plex Mono",
          "SFMono-Regular",
          "Consolas",
          "Liberation Mono",
          "Menlo",
          "monospace"
        ],
        sans: ["Inter", "Arial", "Helvetica", "sans-serif"]
      },
      boxShadow: {
        atlas: "0 0 0 1px #111111"
      }
    }
  },
  plugins: []
};

export default config;
