#!/bin/sh
set -eu
: "${SHOP_TARGET:=shop:3000}"
: "${ENV_NAME:=local}"
: "${RETENTION:=30d}"

sed -e "s|\${SHOP_TARGET}|${SHOP_TARGET}|g" -e "s|\${ENV_NAME}|${ENV_NAME}|g" \
  /etc/prometheus/prometheus.tmpl.yml > /tmp/prometheus.yml
echo "Prometheus: scrape target ${SHOP_TARGET} (env=${ENV_NAME})"

# [::] — слушаем IPv4 и IPv6 (приватная сеть Railway работает по IPv6)
exec /bin/prometheus \
  --config.file=/tmp/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --storage.tsdb.retention.time="${RETENTION}" \
  --web.listen-address="[::]:9090" \
  --web.enable-lifecycle
