FROM node:26-bookworm-slim AS deps
WORKDIR /app

# Install pnpm explicitly because Node 26 slim does not include Corepack.
RUN npm install -g pnpm@10.22.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:26-bookworm-slim AS builder
WORKDIR /app

RUN npm install -g pnpm@10.22.0

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

FROM node:26-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN npm install -g pnpm@10.22.0

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/lib/template.docx ./lib/template.docx

EXPOSE 3000

CMD ["pnpm", "start", "-H", "0.0.0.0", "-p", "3000"]
