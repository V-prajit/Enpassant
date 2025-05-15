FROM --platform=linux/amd64 node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
# If it needs stockfish binary, that needs to be handled here or in the image

COPY . .

# Ensure Stockfish binary is executable if copied
# RUN chmod +x ./path/to/stockfish_binary_if_any

EXPOSE 8080
CMD ["node", "server.js"]
