# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS build
WORKDIR /app
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_LOGLEVEL=error
RUN apk add --no-cache openssl libc6-compat ffmpeg poppler-utils
COPY apps/api/package*.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --prefer-offline --maxsockets=3
COPY apps/api/ ./
RUN npm run prisma:generate && npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat ffmpeg poppler-utils
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p /app/uploads/thumbs
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node dist/main.js"]
