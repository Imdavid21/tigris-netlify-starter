FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/indexer/package.json ./apps/indexer/package.json
RUN npm install --workspace @arc-launchpad/indexer
COPY apps/indexer ./apps/indexer
RUN npm --workspace @arc-launchpad/indexer run build

FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY apps/indexer/package.json ./apps/indexer/package.json
RUN npm install --omit=dev --workspace @arc-launchpad/indexer
COPY --from=build /app/apps/indexer/dist ./apps/indexer/dist
COPY apps/indexer/schema.sql ./apps/indexer/schema.sql
CMD ["npm","--workspace","@arc-launchpad/indexer","run","start"]
