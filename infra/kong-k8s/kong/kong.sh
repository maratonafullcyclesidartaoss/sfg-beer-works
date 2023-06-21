#!/bin/bash
kubectl create ns kong
helm install kong kong/kong -f kong-conf.yaml --set proxy.type=LoadBalancer --set ingressController.installCRDs=false --set serviceMonitor.enabled=true --set serviceMonitor.labels.release=promstack --namespace kong