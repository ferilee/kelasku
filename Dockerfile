FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json package-lock.json ./

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN bun install

COPY . .

RUN bun run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "bun run db:push && bun src/index.ts"]
