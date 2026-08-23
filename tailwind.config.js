/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    fontFamily: {
      'sans': ['Open Sans', 'sans-serif'],
      'urbanist': ['Urbanist', 'sans-serif'],
      // fontFamily khai báo ở cấp theme (không phải extend) sẽ THAY hẳn bảng
      // mặc định của Tailwind, nên phải khai báo lại mono — thiếu nó thì mọi
      // class font-mono im lặng không có tác dụng.
      'mono': ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
    },
    extend: {
      colors: {
        // Bảng màu gốc
        'primary-blue': 'rgb(146, 179, 202)',
        'primary-orange': 'rgb(243, 195, 177)',
        'main-text': 'rgb(0, 43, 49)',
        'error-red': 'rgb(208, 69, 82)',

        // Bổ sung cho giao diện mới: primary-blue quá nhạt để làm màu tương
        // tác (chữ trắng trên nền đó không đạt tương phản), nên lùi nó về vai
        // trò nền nhạt và thêm một tông cùng hệ nhưng đậm hơn để bấm/đọc.
        'accent': 'rgb(46, 90, 110)',
        'accent-strong': 'rgb(29, 62, 75)',
        'accent-tint': 'rgb(243, 247, 248)',

        // Nền và đường kẻ
        'surface': 'rgb(247, 246, 243)',
        'panel': 'rgb(255, 255, 255)',
        'hairline': 'rgb(227, 225, 220)',
        'hairline-soft': 'rgb(240, 238, 233)',

        // Chữ phụ
        'muted': 'rgb(124, 148, 153)',
        'muted-soft': 'rgb(163, 178, 181)',
        'ok': 'rgb(78, 143, 110)',
      },
      animation: {
        'spinner': 'spinner 1.5s linear infinite',
        'spinner-delayed': 'spinner 1.5s linear infinite 0.75s',
      },
      keyframes: {
        spinner: {
          '0%': { transform: 'scale(0)', opacity: 1 },
          '100%': { transform: 'scale(1)', opacity: 0 },
        },
      },
    },
  },
  plugins: [],
};
