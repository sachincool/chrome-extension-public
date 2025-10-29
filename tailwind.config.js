/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,js,jsx,ts,tsx}',
    './src/**/*.html',
    '!./node_modules/**/*',
  ],
  theme: {
    extend: {
      // LinkedIn-inspired color palette
      colors: {
        // Primary LinkedIn blue
        linkedin: {
          50: '#f0f8ff',
          100: '#e0f0fe',
          200: '#b8e1fe',
          300: '#7cc8fd',
          400: '#36acfa',
          500: '#0a66c2', // Main LinkedIn blue
          600: '#004182',
          700: '#003366',
          800: '#002952',
          900: '#001f3d',
        },
        // Semantic colors for LinkedIntel
        success: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Neutral grays optimized for extension UI
        gray: {
          50: '#f8f9fa',
          100: '#f1f3f4',
          200: '#e8eaed',
          300: '#dadce0',
          400: '#bdc1c6',
          500: '#9aa0a6',
          600: '#80868b',
          700: '#5f6368',
          800: '#3c4043',
          900: '#202124',
        },
        // Extension-specific colors
        extension: {
          bg: '#ffffff',
          surface: '#f8f9fa',
          border: '#e0e0e0',
          text: '#1a1a1a',
          'text-secondary': '#666666',
          'text-muted': '#999999',
        },
      },
      // Typography scale optimized for small extension UI
      fontSize: {
        xs: ['11px', { lineHeight: '16px' }],
        sm: ['12px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '28px' }],
        '2xl': ['20px', { lineHeight: '32px' }],
        '3xl': ['24px', { lineHeight: '36px' }],
      },
      // Spacing optimized for compact extension UI
      spacing: {
        0.5: '2px',
        1: '4px',
        1.5: '6px',
        2: '8px',
        2.5: '10px',
        3: '12px',
        3.5: '14px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
        20: '80px',
      },
      // Border radius values
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        full: '9999px',
      },
      // Box shadows optimized for extension context
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 2px 4px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 8px 16px -4px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 12px 24px -6px rgba(0, 0, 0, 0.15), 0 8px 16px -4px rgba(0, 0, 0, 0.1)',
        extension: '0 4px 16px rgba(0, 0, 0, 0.15)',
        notification: '0 8px 32px rgba(0, 0, 0, 0.2)',
      },
      // Animation durations
      transitionDuration: {
        150: '150ms',
        200: '200ms',
        250: '250ms',
        300: '300ms',
        350: '350ms',
        400: '400ms',
        500: '500ms',
      },
      // Extension-specific z-index values
      zIndex: {
        extension: '999999',
        modal: '1000000',
        tooltip: '1000001',
        notification: '1000002',
      },
      // Component sizing
      width: {
        sidebar: '360px',
        sidepanel: '400px',
        notification: '320px',
      },
      maxWidth: {
        sidebar: '360px',
        sidepanel: '400px',
        notification: '320px',
      },
      // Animation keyframes
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out-right': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-10px)' },
        },
        'pulse-soft': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-out-right': 'slide-out-right 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-out': 'fade-out 0.3s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 2s linear infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    // Custom plugin for extension-specific utilities
    function ({ addUtilities, addComponents, theme }) {
      // Extension-specific utilities
      addUtilities({
        '.extension-reset': {
          all: 'initial',
          'font-family':
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          'box-sizing': 'border-box',
        },
        '.extension-isolate': {
          isolation: 'isolate',
          'z-index': theme('zIndex.extension'),
        },
        '.no-linkedin-styles': {
          all: 'unset',
          display: 'revert',
        },
      })

      // Component base styles removed - these classes are not used in the codebase
      // If needed in the future, they can be added back or implemented inline
    },
  ],
  // Ensure no conflicts with LinkedIn styles
  corePlugins: {
    preflight: false, // Disable CSS reset to avoid conflicts
  },
  // Important strategy for extension context
  important: '.linkedintel-root', // Scope all styles to LinkedIntel containers
}
