FROM imbios/bun-node:latest-18-slim AS build

WORKDIR /app

COPY bun.lockb package.json ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM nginx:1.27-alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
