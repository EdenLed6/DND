import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#f3ecd9",
        ink: "#2b241d",
        blood: "#7a2b2f",
        gold: "#8a6b30",
        arcane: "#6e5b9b",
        forest: "#6f8a5b",
        heading: "#7a2b2f",
        sage: "#8c9877",
        mist: "#8da7b4",
        rust: "#a85d3b",
      },
      fontFamily: {
        display: ["Cinzel", "Iowan Old Style", "Palatino", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
