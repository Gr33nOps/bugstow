# ── Stage 1: build the frontend (static dist) ────────────────────────────────
FROM node:22-slim AS webbuild
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: server runtime (Node + SQLite, serves the built frontend) ───────
FROM node:22-slim AS server
WORKDIR /app/server

# better-sqlite3 ships prebuilt binaries; build tools are a fallback for
# platforms without one. They are removed afterwards to keep the image small.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json* ./
RUN npm ci

COPY server/ ./
COPY --from=webbuild /app/dist /app/dist

ENV NODE_ENV=production
ENV PORT=8080
ENV BUGSTOW_DATA_DIR=/data
ENV BUGSTOW_PUBLIC_DIR=/app/dist

# Persistent data (SQLite database + screenshots) lives here.
VOLUME ["/data"]
EXPOSE 8080

CMD ["npx", "tsx", "src/index.ts"]
