FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
EXPOSE 3000
CMD ["sh", "-c", "pnpm install --store-dir /tmp/.pnpm-store && pnpm dev"]
