# AlphaPicker — production image (build + run; keeps tsx for db migrate/seed).
FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install all deps (build needs typescript/tailwind; runtime needs tsx for migrations).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENV PORT=3000
CMD ["/entrypoint.sh"]
