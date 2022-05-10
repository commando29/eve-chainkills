FROM node:18-alpine3.14

WORKDIR /app

COPY package.json /app
COPY package-lock.json /app
RUN npm ci --only=production && npm cache clean --force
COPY . /app

CMD node index.js