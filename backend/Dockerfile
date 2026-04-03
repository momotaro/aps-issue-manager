FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /workspace
EXPOSE 4000
CMD ["sh", "-c", "pnpm install --store-dir /tmp/.pnpm-store && pnpm --filter backend migrate && pnpm --filter backend dev"]
