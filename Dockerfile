FROM node:16.0.0-alpine

ARG host
ENV HOST=$host
ARG attempts
ENV ATTEMPTS=$attempts
ARG delay
ENV DELAY=$delay
ARG department
ENV DEPARTMENT=$department

WORKDIR /app
COPY package.json /app
RUN npm i --only=production
COPY . /app

CMD node index.js