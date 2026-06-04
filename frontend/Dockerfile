FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
# npm mirror를 설정하여 네트워크 지연 및 Docker 빌드 시 npm install 멈춤 현상을 방지합니다.
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]

