FROM prom/prometheus:v3.15.1
COPY prometheus.yml /etc/prometheus/prometheus.tmpl.yml
COPY --chmod=755 entrypoint.sh /entrypoint.sh
# Тома Railway монтируются от root — иначе Prometheus не сможет писать в /prometheus
USER root
EXPOSE 9090
ENTRYPOINT ["/entrypoint.sh"]
