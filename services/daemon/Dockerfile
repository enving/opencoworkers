FROM node:20-alpine
WORKDIR /app

# Install dependencies for building native modules if needed
RUN apk add --no-cache python3 make g++ git

COPY package*.json ./
RUN npm ci

COPY . .

# Skip build step and use ts-node directly
CMD ["npx", "tsx", "index.ts"]
