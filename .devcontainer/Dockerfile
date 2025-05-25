ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=1000

FROM node:20-alpine

ARG USERNAME
ARG USER_UID
ARG USER_GID

RUN apk add --no-cache \
    bash \
    git \
    build-base \
    openssh \
    ca-certificates && \
    update-ca-certificates

RUN deluser node && \
    addgroup -g $USER_GID $USERNAME && \
    adduser -u $USER_UID -G $USERNAME -s /bin/sh -D $USERNAME && \
    mkdir -p /workspace && \
    chown -R $USERNAME:$USERNAME /workspace

USER $USERNAME

WORKDIR /workspace
