FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "server.cjs"]
