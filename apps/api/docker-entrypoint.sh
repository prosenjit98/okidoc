#!/bin/sh
# Okidoc API container entrypoint: apply pending Prisma migrations, then run the given command
# (default: the API server). Set MIGRATE_ON_START=false to skip, e.g. when running several API replicas.
set -e

if [ "${MIGRATE_ON_START:-true}" = "true" ]; then
  echo "okidoc: applying database migrations"
  /app/node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
fi

exec "$@"
