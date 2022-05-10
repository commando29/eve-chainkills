FROM node:18-alpine3.14

# Create app directory
RUN mkdir -p /app
WORKDIR /app

# Install app dependencies
COPY package.json /app
COPY package-lock.json /app
# RUN npm ci --only=production && npm cache clean --force
RUN npm install
COPY . /app

CMD node index.js