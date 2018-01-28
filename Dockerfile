FROM node:6-slim

EXPOSE 8080

COPY package.json /app/
WORKDIR /app

COPY dist /app/
COPY node_modules /app/node_modules/

ENTRYPOINT ["node","index.js"]
