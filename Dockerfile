## All together
# docker stop coNext & docker image rm -f next & docker build -t next . && docker run -it --rm -dp 3000:3000 --name coNext next && docker exec -it coNext sh

# Start Dockerfile
ARG VERSION=22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
ARG DIR=usr/app

FROM node:${VERSION} AS builder
# redeclare ARG because ARG not in build environment
ARG DIR
WORKDIR /${DIR}
RUN apk add --no-cache python3 make g++
COPY . .
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install
RUN pnpm build

FROM node:${VERSION} AS runner
# redeclare ARG because ARG not in build environment
ARG DIR
WORKDIR /${DIR}
COPY --from=builder /${DIR}/.next/standalone .
COPY --from=builder /${DIR}/public ./public
COPY --from=builder /${DIR}/.next/static ./.next/static

EXPOSE 3000
ENTRYPOINT ["node", "server.js"]