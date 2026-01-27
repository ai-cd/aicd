/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#f4f4f4",
        foreground: "#0b0b0b",
        muted: "#d9d9d9",
        "muted-foreground": "#4d4d4d",
        border: "#bdbdbd",
        input: "#c9c9c9",
        primary: "#0b0b0b",
        "primary-foreground": "#f4f4f4",
        secondary: "#e6e6e6",
        "secondary-foreground": "#1a1a1a",
        accent: "#101010",
        "accent-foreground": "#f4f4f4",
        destructive: "#b91c1c",
        "destructive-foreground": "#fff1f1"
      },
      borderRadius: {
        lg: "0px",
        md: "0px",
        sm: "0px"
      },
      fontFamily: {
        display: ["Teko", "sans-serif"],
        body: ["Space Grotesk", "sans-serif"]
      },
      boxShadow: {
        sharp: "6px 6px 0 #0b0b0b"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};
