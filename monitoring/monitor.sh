kubectl create namespace exercises-monitoring

cd monitoring/

helm upgrade --install prom prometheus-community/prometheus   --namespace exercises-monitoring   --create-namespace   --values prom-values.yml

helm upgrade --install loki grafana/loki   --namespace exercises-monitoring   --values loki-values.yml

helm upgrade --install k8smon grafana/k8s-monitoring \
  --namespace exercises-monitoring \
  --values alloy-values.yml

helm upgrade --install grafana grafana/grafana \
  --namespace exercises-monitoring \
  --values grafana-values.yml

cd ..

echo "Everything is set up correctly "

echo "kubectl port-forward --namespace exercises-monitoring svc/grafana 2000:80"