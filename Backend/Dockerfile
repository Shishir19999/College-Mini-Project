# Backend image (Node 24 LTS). Build context: the repository root (the API shares code with /shared).
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY shared ./shared
WORKDIR /app/Backend
COPY Backend/package*.json ./
RUN npm ci --omit=dev
COPY Backend/ ./
RUN mkdir -p /data/uploads && chown -R node:node /data/uploads
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=4s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
