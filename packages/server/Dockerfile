# Build from repo root: docker build -f packages/server/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/agent/package.json packages/agent/
COPY packages/dashboard/package.json packages/dashboard/

# Agent has no chromium postinstall (it attaches to an existing browser over CDP),
# so a plain workspace install is enough to link @most/shared everywhere.
RUN npm install --no-audit --no-fund

COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/dashboard packages/dashboard

RUN npm run build:shared \
  && npm run build:server \
  && npm run build -w @most/dashboard

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build /app/packages/server/package.json /app/packages/server/package.json
COPY --from=build /app/packages/server/dist /app/packages/server/dist
COPY --from=build /app/packages/dashboard/dist /app/packages/dashboard/dist

EXPOSE 3030
CMD ["node", "packages/server/dist/index.js"]
