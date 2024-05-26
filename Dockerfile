FROM node:20

ENV APP_DIR=/app
WORKDIR ${APP_DIR}

RUN groupadd -g 10001 app \
    && useradd -u 10001 -g 10001 --home ${APP_DIR} -ms /bin/bash app \
    && chown app ${APP_DIR}

COPY --chown=app index.js \
    tsconfig.build.json \
    tsconfig.json \
    package.json \
    yarn.lock \
    eslint.config.js \
    ${APP_DIR}/

USER app

RUN yarn

COPY --chown=app src ${APP_DIR}/src

RUN npm run build


CMD ["node","./index.js"]