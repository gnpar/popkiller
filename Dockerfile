FROM node:14-alpine

LABEL maintainer="Gabriel Parrondo <gabriel@parrondo.com.ar>"

EXPOSE 2525

ENV NODE_ENV=production
ENV POPKILLER_HOST=0.0.0.0

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["npm", "start"]
