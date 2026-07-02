import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Semantic ivy tokens — usable as bg-gold-400, text-sage-400, etc.
        gold: {
          100: "hsl(var(--gold-100))",
          300: "hsl(var(--gold-300))",
          400: "hsl(var(--gold-400))",
          500: "hsl(var(--gold-500))",
        },
        sage: {
          100: "hsl(var(--sage-100))",
          300: "hsl(var(--sage-300))",
          400: "hsl(var(--sage-400))",
          500: "hsl(var(--sage-500))",
        },
        ember: {
          400: "hsl(var(--ember-400))",
          500: "hsl(var(--ember-500))",
        },
        periwinkle: {
          400: "hsl(var(--periwinkle-400))",
          500: "hsl(var(--periwinkle-500))",
        },
        ink: {
          50:  "hsl(var(--ink-50))",
          200: "hsl(var(--ink-200))",
          400: "hsl(var(--ink-400))",
          600: "hsl(var(--ink-600))",
          700: "hsl(var(--ink-700))",
          800: "hsl(var(--ink-800))",
          900: "hsl(var(--ink-900))",
        },
      },
      borderRadius: {
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 3px)",
        sm:   "calc(var(--radius) - 6px)",
        xl:   "calc(var(--radius) + 4px)",
        "2xl":"calc(var(--radius) + 10px)",
        "3xl":"calc(var(--radius) + 18px)",
      },
      fontFamily: {
        sans:    ["Instrument Sans", "DM Sans", "system-ui", "sans-serif"],
        display: ["Newsreader", "Lora", "Georgia", "serif"],
        mono:    ["DM Mono", "Fira Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.2" }],
      },
      letterSpacing: {
        tightest: "-0.05em",
        tighter:  "-0.03em",
        tight:    "-0.015em",
        wide:     "0.04em",
        wider:    "0.08em",
        widest:   "0.14em",
      },
      spacing: {
        "safe-t": "env(safe-area-inset-top, 0px)",
        "safe-b": "env(safe-area-inset-bottom, 16px)",
        "safe-l": "env(safe-area-inset-left, 0px)",
        "safe-r": "env(safe-area-inset-right, 0px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-bottom": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to:   { backgroundPosition: "-200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-6px)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        "record-ring": {
          "0%":   { transform: "scale(1)",    opacity: "0.6" },
          "100%": { transform: "scale(1.65)", opacity: "0" },
        },
        "waveform-bar": {
          "0%, 100%": { transform: "scaleY(0.25)" },
          "50%":      { transform: "scaleY(1)" },
        },
        "glow-pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 18px rgba(204,163,72,0.18)" },
          "50%":       { boxShadow: "0 0 36px rgba(204,163,72,0.36)" },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        "fade-in":         "fade-in 0.36s cubic-bezier(0.22,1,0.36,1)",
        "fade-in-scale":   "fade-in-scale 0.28s cubic-bezier(0.22,1,0.36,1)",
        "slide-in-bottom": "slide-in-bottom 0.36s cubic-bezier(0.22,1,0.36,1)",
        shimmer:           "shimmer 2.5s linear infinite",
        float:             "float 5s ease-in-out infinite",
        "spin-slow":       "spin-slow 9s linear infinite",
        "record-ring":     "record-ring 1.2s ease-out infinite",
        "waveform-bar":    "waveform-bar 0.7s ease-in-out infinite",
        "glow-pulse-gold": "glow-pulse-gold 2.8s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":  "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
