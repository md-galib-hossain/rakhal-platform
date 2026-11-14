# Local Observability Run Steps (Stages 1-5)

## Start Stack
```bash
cd observability
docker compose up -d
```

## Start API
```bash
npm run start:dev
```

## Verify Services
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)
- Alertmanager: http://localhost:9093
- Loki: http://localhost:3100

## Verify Metrics
In Prometheus query:
```promql
http_requests_total
```

## Verify Logs
1. Create log file path:
```bash
mkdir logs
```
2. Run app with file output:
```bash
npm run start:prod > logs/app.log
```
3. In Grafana Explore (Loki datasource):
```logql
{job="rakhal-api"}
```

## Verify Alerts
- Alerts loaded from `observability/prometheus/alerts.yml`.
- Fire a test 5xx and confirm alert appears and routes through Alertmanager.
