import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#eee5ce",
        ink: "#2a1f10",
        blood: "#8a2018",
        gold: "#7f6a2c",
        arcane: "#5a3d8f",
        forest: "#3f6212",
        heading: "#58180d",
      },
      fontFamily: {
        display: ["Cinzel", "Iowan Old Style", "Palatino", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
