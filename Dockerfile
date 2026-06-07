## All together
# docker stop coNext & docker image rm -f next & docker build -t next . && docker run -it --rm -dp 3000:3000 --name coNext next && docker exec -it coNext sh

# Start Dockerfile
ARG VERSION=alpine3.17
ARG DIR=usr/app

FROM node:${VERSION} as builder
# redeclare ARG because ARG not in build environment
ARG DIR
WORKDIR /${DIR}
COPY . .
RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build

FROM node:${VERSION} as runner
# redeclare ARG because ARG not in build environment
ARG DIR
WORKDIR /${DIR}
COPY --from=builder /${DIR}/.next/standalone .
COPY --from=builder /${DIR}/public ./public
COPY --from=builder /${DIR}/.next/static ./.next/static

EXPOSE 3000
ENTRYPOINT ["node", "server.js"]