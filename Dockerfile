FROM node:20

COPY index.js \
    tsconfig.build.json \
    tsconfig.json \
    package.json \
    package-lock.json \
    eslint.config.js \
    src/

RUN npm i && npm run build

USER node

CMD ["node","./index.js"]