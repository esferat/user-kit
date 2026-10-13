# Keycloak with a writable log directory for the file log handler.
#
# With KC_LOG=console,file Keycloak writes data/log/keycloak.log, which Logstash
# tails. The directory is created here, owned by the container user, so the named
# volume mounted onto it inherits the ownership and Keycloak may write there.
ARG KEYCLOAK_VERSION=26.4
FROM quay.io/keycloak/keycloak:${KEYCLOAK_VERSION}

USER root
RUN mkdir -p /opt/keycloak/data/log && chown -R keycloak:root /opt/keycloak/data/log
USER keycloak
