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

# Standalone output ships only production-traced dependencies, so no package
# manager or devDependencies are installed in the runtime image.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/lib/template.docx ./lib/template.docx

EXPOSE 3000

CMD ["node", "server.js"]
