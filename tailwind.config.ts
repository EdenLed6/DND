import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#f4ecd8",
        ink: "#1b1512",
        blood: "#7b1e1e",
        gold: "#c9a227",
        arcane: "#4b3f72",
        forest: "#2f4f2f",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
