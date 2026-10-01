FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/worker/package.json services/worker/package.json
RUN npm install
COPY packages/shared packages/shared
COPY services/worker services/worker
RUN npm run build --workspace @event-demo/shared && npm run build --workspace worker

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/services/worker/dist services/worker/dist
COPY --from=build /app/services/worker/package.json services/worker/package.json
CMD ["node", "services/worker/dist/index.js"]
