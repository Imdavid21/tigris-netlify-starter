FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --workspace @arc-launchpad/api
COPY apps/api ./apps/api
RUN npm --workspace @arc-launchpad/api run build

FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install --omit=dev --workspace @arc-launchpad/api
COPY --from=build /app/apps/api/dist ./apps/api/dist
CMD ["npm","--workspace","@arc-launchpad/api","run","start"]
