FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
COPY . .
CMD ["node", "server.cjs"]
