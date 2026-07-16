FROM node:22-alpine
WORKDIR /app

# Prisma needs openssl at build and runtime
RUN apk add --no-cache openssl

# Install all deps (dev deps are needed for `prisma db push` and the tsx seed
# run at container start; this keeps `docker compose up` a one-command demo).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
ENV JOBS_DISABLE_WORKER=false
RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
