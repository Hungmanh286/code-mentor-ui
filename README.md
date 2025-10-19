# mentor Chatbot Frontend

This repository contains the frontend code for the mentor Chatbot application. It is built using React and powered by Vite for a fast development experience. The project uses Bun as the package manager and is compatible with Node.js 18.

## Prerequisites

Before setting up the project, ensure you have the following installed on your system:

- **Node.js**: Version 18.x
- **Bun**: Latest version ([Installation guide](https://bun.sh/))

## Getting Started

Follow these steps to set up and run the project locally:

### 1. Clone the repository

```bash
git clone https://gitlab.ovp.vn/llm/mentor-bot.git -b langchain-ui
cd mentor-bot
```

### 2. Install dependencies

Use Bun to install the project dependencies:

```bash
bun install
```

### 3. Start the development server

Run the following command to start the Vite development server:

```bash
bun run dev
```

The application will be accessible at [http://localhost:4000](http://localhost:4000) by default.

### 4. Build for production

To create a production-ready build, run:

```bash
bun run build
```

The output files will be generated in the `dist` directory.

### 5. Preview the production build

You can preview the production build locally using:

```bash
bun run preview
```

## Key Features

- **React**: Modern UI development
- **Vite**: Fast build tool optimized for frontend projects
- **Bun**: Blazing-fast JavaScript runtime and package manager
- **Node.js 18**: Ensures compatibility with the latest features and security updates

## License

This project is licensed under the [MIT License](./LICENSE).

## Acknowledgments

- [Vite](https://vitejs.dev/)
- [Bun](https://bun.sh/)
- [React](https://reactjs.org/)
