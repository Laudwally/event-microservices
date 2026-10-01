FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/gateway/package.json services/gateway/package.json
RUN npm install
COPY packages/shared packages/shared
COPY services/gateway services/gateway
RUN npm run build --workspace @event-demo/shared && npm run build --workspace gateway

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/services/gateway/dist services/gateway/dist
COPY --from=build /app/services/gateway/package.json services/gateway/package.json
EXPOSE 3000
CMD ["node", "services/gateway/dist/index.js"]
