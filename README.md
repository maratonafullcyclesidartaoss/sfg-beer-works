# SFG Beer Works - RESTful Brewery Service - CI / CD & Monitoramento em Produção

O projeto é baseado em uma _API REST_ para fins didáticos desenvolvida por [John Thompson](http://www.linkedin.com/in/springguru). Neste [link](https://sfg-beer-works.github.io/brewery-api/#tag/Beer-Service), pode-se acessar a documentação da _API_.

Tecnologias

Adicionalmente ao projeto original, foram inseridas tecnologias de _Continuous Integration_ / _Continuous Deployment_ e monitoramento aplicado ao _API Gateway_ e à _API_ de _backend_:

- Backend
    - Java (JDK 11)
    - Spring Boot 2.4.5

- API Gateway
  - Kong

- Monitoramento
  - Métricas
    - Prometheus

- GitOps
  - ArgoCD (GitOps Tool)

- IaC
  - Terraform

- Deploy
  - Kubernetes GKE

### APIOps

#### Design

Dentro do ciclo de desenvolvimento de _APIs_, iniciamos com o _design_ do contrato (ou _API_). Dessa forma, com base em um modelo de especificação de contratos - o _OpenAPI_, geramos um artefato no formato _.yaml_, com o nome de _brewery-api.yaml_ e que pode ser encontrado no diretório _assets/api-docs_.

A especificação do contrato pode ser visualizada, também, em um formato _Swagger_:

![Definição do contrato (API)](./images/definicao-contrato-api.png)

Iremos seguir um processo de _deployment_ de _APIs_ baseado em _APIOps_, conforme o seguinte fluxo:

![Fluxo deployment APOps](./images/fluxo-deployment-apiops.png)
<div align="center">Fonte: FULL CYCLE 3.0. API Gateway com Kong e Kubernetes.</div>

### CI/CD

#### Continuous Integration

Dentro do processo de _CI_, estamos utilizando _GitHub Actions_ como ferramenta.

O processo de _CI_ consiste, basicamente, em:

- Validar a conformidade do padrão de contrato;
  - Utilizado uma ferramenta de _lint_ chamada _[Spectral](https://stoplight.io/open-source/spectral)_, da _[Stoplight](https://stoplight.io/)_, a qual define uma série de regras (_ruleset_) no arquivo _assets/rules/openapi3.spectral.yaml_.
- Realizar os testes de contrato;
  - Utilizando uma ferramenta de _mock_ chamada _[Prism](https://docs.stoplight.io/docs/prism/674b27b261c3c-prism-overview)_, da _[Stoplight](https://stoplight.io/)_, a qual provê servidores de _mock_ para testar as _APIs_, conjuntamente com uma ferramenta para rodar uma _collection_ do _Postman_ com testes de _APIs_, chamada _[Newman](https://learning.postman.com/docs/collections/using-newman-cli/command-line-integration-with-newman/)_.

![Check API Contract](./images/check-api-contract.png)

- Rodar os testes unitários;

- Rodar o _Scan_ do _SonarCloud_;
  - Utilizando o _report_ de cobertura de código gerado pelo _Jacoco_.

#### Continuous Delivery

O nosso processo de _CD_ é responsável por:

- Realizar o _build_ da aplicação;

- Construir uma nova imagem _Docker_ e subir para o _DockerHub_;

- Alterar o artefato _k8s/kustomization.yaml_ com a _tag_ da nova imagem;
  - Utilizando a ferramenta [Kustomize](https://kustomize.io/);

- Comitar as alterações;

- Fazer o _push_ das alterações para o repositório do _GitHub_.

### Terraform

Neste momento, vamos provisionar um _cluster_ _GKE_ (_Google Cloud_), baseado no [tutorial](https://developer.hashicorp.com/terraform/tutorials/kubernetes/gke) da [HashiCorp](https://www.hashicorp.com/).

A infraestrutura provisionada consiste, basicamente, em um _cluster_ de 3 nós distribuídos em 3 zonas de disponibilidade distintas dentro de uma _VPC_ na região de _us-central1_:

![Infraestrutura provisionada](./images/infraestrutura-provisionada.png)

### Kong API Gateway

1. Instalar o _Prometheus_ para monitoramento das métricas de _API_:
- /infra/kong-k8s/misc/prometheus/prometheus.sh;

2. Instalar o _Kong API Gateway_:
- /infra/kong-k8s/kong/kong.sh;

3. Instalar o _Keycloak_ como _Identity Provider_ (_IDP_), provendo autenticação com o _OpenID Connect_ como especificação de segurança da aplicação:
- /infra/kong-k8s/misc/keycloak/keycloak.sh;

4. Configurar o _Keycloak_ com:
- Um _realm_ _brewery_;
- Um usuário _maria_;
- Um _client_ _kong_;

5. Aplicar os manifestos de _Deployment_ e _Service_ da aplicação no _namespace_ _brewery_;
- /infra/kong-k8s/misc/apps/deployments/brewery.yaml;
- /infra/kong-k8s/misc/apps/services/brewery.yaml;

6. Aplicar o manifesto do _Custom Resource Definition_ _(CRD)_ de _KongPlugin_ para _rate limiting_ no _namespace_ _brewery_;

7. Aplicar o manifesto do _CRD_ de _KongClusterPlugin_ para _Prometheus_ com a configuração das métricas para coleta:
- _status_code_metrics_
- _status_code_metrics_
- _latency_metrics_
- _upstream_health_metrics_
- _bandwidth_metrics_

8. Aplicar o manifesto do objeto _Ingress_ do _Kubernetes_ e do _CRD_ _KongIngress_ para rotear o serviço para o _path_ _/beer-service_ do _Kong_;
```
$ kubectl get svc -n kong

NAME                           TYPE           CLUSTER-IP      EXTERNAL-IP     PORT(S)                         AGE
kong-kong-admin                NodePort       10.51.249.27    <none>          8001:32217/TCP,8444:30106/TCP   89m
kong-kong-proxy                LoadBalancer   10.51.248.77    34.27.181.171   80:31967/TCP,443:31040/TCP      89m
kong-kong-validation-webhook   ClusterIP      10.51.251.191   <none>          443/TCP                         89m


$ curl 34.27.181.171/beer-service/api/v1/beer/0273aea6-fc8e-4c16-805d-59e85cfa7e91
{
   "id":"0273aea6-fc8e-4c16-805d-59e85cfa7e91",
   "beerName":"Mango Bobs",
   "beerStyle":"ALE",
   "upc":"0631234200036",
   "price":35.96,
   "quantityOnHand":3033,
   "createdDate":"2023-06-20T00:43:21.485Z",
   "lastUpdatedDate":null
}
```

Verificamos que o serviço foi configurada com sucesso para ser roteado no _Kong_. No entanto, a _API_ continua exposta, i.e., é possível acessá-la sem autenticação. O passo seguinte, então, consiste em adicionar um _plugin_ de _OpenID Connect_ ao _Kong API Gateway_. 

9. Aplicar o manifesto do _CRD_ de _KongPlugin_ para _OpenID Connect_ no _namespace_ _brewery_;
- /infra/kong-k8s/misc/apis/kopenid.yaml;

10. Re-aplicar o manifesto do objeto _Ingress_ adicionando a anotação do _Kong_ que associa o _plugin_ de _OpenID Connect_;
- /infra/kong-k8s/misc/apis/brewery-api.yaml;
```
$ curl 34.27.181.171/beer-service/api/v1/beer/0273aea6-fc8e-4c16-805d-59e85cfa7e91
{
   "message":"Unauthorized"
}
```

Verificamos, neste momento, que a _API_ passa a estar protegida. No entanto, não é mais possível acessá-la sem informar um _token_ de autenticação. Para isso, iremos criar um novo _POD_ para obter o _token_ a partir de um _container_ do _cluster Kubernetes_.

11. Obter _token_ _JWT_:
```
cd infra/kong-k8s/misc/token
./apply-token.sh
kubectl exec -it testcurl -- sh

~ $ curl --location --request POST 'http://keycloak.iam/realms/brewery/protocol/openid-connect/token' \
--header 'Content-Type: application/x-www-form-urlencoded' \
--data-urlencode 'client_id=kong' \
--data-urlencode 'grant_type=password' \
--data-urlencode 'username=maria' \
--data-urlencode 'password=maria' \
--data-urlencode 'client_secret=mtwMxgwxUbz3ksEtRi2hCVhxZCYqSQgH' \
--data-urlencode 'scope=openid'

$ curl -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJOTnZlS1Z6Mi10ZmJiZlFzZ0JpdF9BZ2ZybjJpSWxweVl2SmNkNGlDZXlzIn0.eyJleHAiOjE2ODcyMjUxMzIsImlhdCI6MTY4NzIyNDgzMiwianRpIjoiNWFhMjkzYTItYThhNC00OTA3LTgyOTMtMzkzOGMxYTJjMjZlIiwiaXNzIjoiaHR0cDovL2tleWNsb2FrLmlhbS9yZWFsbXMvYnJld2VyeSIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiIzNWQwOGJjYS02YjJkLTRkNzUtOWJjMC1iM2Y4MGZkMzM5MTUiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJrb25nIiwic2Vzc2lvbl9zdGF0ZSI6IjI2MmRkMWIyLTZmYmMtNDYyYi1iM2I2LTMzMjIxZjIzZDgwMSIsImFjciI6IjEiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiIsImRlZmF1bHQtcm9sZXMtYnJld2VyeSJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwiLCJzaWQiOiIyNjJkZDFiMi02ZmJjLTQ2MmItYjNiNi0zMzIyMWYyM2Q4MDEiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsInByZWZlcnJlZF91c2VybmFtZSI6Im1hcmlhIiwiZ2l2ZW5fbmFtZSI6IiIsImZhbWlseV9uYW1lIjoiIn0.iVlyDP8eohr9q8Y8db7ZpjoAqfK1Ef5727AgB-fyq_0GACsqgnHA5c44IDyxFVSf3olNgral5jyRWpBiix0BrSl-XJSFA4X4mqwJep7VbF7HVsCw_WGShRGE7RH6kpwDhT-eJYq3FRBIRdXSskHVJCOytrEGWQGHwsYiLgWqKmFYBeeBLj7TItFRN-7LbvWvlEkToTPGsT_lpC9e1yB62HenI71nH89KhYoWF6rvwiY2xWCuy_lwCQA-o-tLW_-N47yjZic0MIy1JKr7BITULy1cWkbyX3oa_1j4jgLYrbhWN2-LJPD7gEDWwQ3RXOgJlEhKuXiZSUWXvrZKlB02Ig" 34.27.181.171/beer-service/api/v1/beer/0273aea6-fc8e-4c16-805d-59e85cfa7e91

 {
   "id":"0273aea6-fc8e-4c16-805d-59e85cfa7e91",
   "beerName":"Mango Bobs",
   "beerStyle":"ALE",
   "upc":"0631234200036",
   "price":35.96,
   "quantityOnHand":3033,
   "createdDate":"2023-06-20T00:43:21.485Z",
   "lastUpdatedDate":null
}
```

12. Instalar o ArgoCD (_GitOps Operator_)
```
$ cd infra/kong-k8s/argo
$ ./argo.sh
```

13. Instalar a aplicação no _ArgoCD_, conforme _CRD_ _Application_ do próprio _ArgoCD_:
```
$ cd ../../../
$ kubectl apply -f infra/argo-apps/brewery.yaml -n argocd
```

14. Acessar a interface do _ArgoCD_ via _port-forward_:
```
$ kubectl port-forward svc/argocd-server -n argocd 8083:443
```

![Aplicação brewery ArgoCD](./images/aplicacao-brewery-argocd.png)

Neste momento, o repositório do _GitHub_ torna-se a fonte da verdade (_source of truth_): qualquer alteração no repositório é sincronizada automaticamente com o _cluster Kubernetes_.

### Testes de carga

15. Instalar o _[Testkube](https://testkube.io/)_ (infraestrutura para rodar os testes);
```
$ cd infra/load/infra
$ ./install.sh
```

16. Verificar instalação:
```
$ kubectl get po -n testkube

NAME                                                    READY   STATUS    RESTARTS      AGE
testkube-api-server-7f7c45cff9-x854x                    1/1     Running   0             2m47s
testkube-dashboard-65b84ff9d-9wlz5                      1/1     Running   0             2m47s
testkube-minio-testkube-bd549c85d-tppm4                 1/1     Running   2 (20s ago)   2m47s
testkube-mongodb-d78699775-kh9gs                        1/1     Running   0             2m47s
testkube-nats-0                                         3/3     Running   0             2m47s
testkube-nats-box-5b555bc9c4-l4pgm                      1/1     Running   0             2m47s
testkube-operator-controller-manager-76b79584b4-gqbrg   2/2     Running   0             2m47s
```

#### Preparando cluster

17. Verificar instalação do _metrics-server_ (responsável por coletar e fornecer as métricas de utilização de _CPU_ e memória para o _HorizontalPODAutoscaler_ (_HPA_)). Geralmente, o _Cloud Provider_ instala por padrão no momento da criação do _cluster_;
```
$ kubectl get po -n kube-system

NAME                                                             READY   STATUS    RESTARTS   AGE
event-exporter-gke-755c4b4d97-v5kbg                              2/2     Running   0          4h55m
fluentbit-gke-4pf8k                                              2/2     Running   0          4h50m
fluentbit-gke-dn9xl                                              2/2     Running   0          4h50m
fluentbit-gke-nvxdx                                              2/2     Running   0          4h50m
gke-metrics-agent-9sz2g                                          2/2     Running   0          4h50m
gke-metrics-agent-cj5cl                                          2/2     Running   0          4h50m
gke-metrics-agent-p67tc                                          2/2     Running   0          4h50m
konnectivity-agent-65c88cbd8d-m2k8d                              1/1     Running   0          4h49m
konnectivity-agent-65c88cbd8d-q7pj4                              1/1     Running   0          4h56m
konnectivity-agent-65c88cbd8d-z4r44                              1/1     Running   0          4h49m
konnectivity-agent-autoscaler-7dc78c8c9-5thjx                    1/1     Running   0          4h56m
kube-dns-5b5dfcd97b-lgwws                                        4/4     Running   0          4h56m
kube-dns-5b5dfcd97b-wpx5f                                        4/4     Running   0          4h49m
kube-dns-autoscaler-5f56f8997c-99jww                             1/1     Running   0          4h56m
kube-proxy-gke-kbe-rest-brewery-kbe-rest-brewery-7e9a31e7-25rq   1/1     Running   0          4h50m
kube-proxy-gke-kbe-rest-brewery-kbe-rest-brewery-8b68eca7-907l   1/1     Running   0          4h50m
kube-proxy-gke-kbe-rest-brewery-kbe-rest-brewery-f34bffcc-twdj   1/1     Running   0          4h50m
l7-default-backend-676d84669b-h9ntw                              1/1     Running   0          4h55m
metrics-server-v0.5.2-67864775dc-t9jp8                           2/2     Running   0          4h49m
pdcsi-node-mrx8x                                                 2/2     Running   0          4h50m
pdcsi-node-txx7c                                                 2/2     Running   0          4h50m
pdcsi-node-zkc8q                                                 2/2     Running   0          4h50m
```

18. Aplicar o manifesto do objeto _HPA_ para o _Kubernetes_ trabalhar com _upscaling_ e _downscaling_, conforme a porcentagem de utilização de _CPU_ para o _Deployment_;
```
$ kubectl apply -f infra/kong-k8s/misc/apps/hpa/brewery.yaml -n brewery
```

19. Verificar instalação do _HPA_;
```
$ kubectl get horizontalpodautoscaler -n brewery

NAME          REFERENCE            TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
brewery-hpa   Deployment/brewery   1%/70%    1         20        1          10m
```

20. Instalar o _plugin_ do _Kong_ de _Prometheus_ e de _rate-limiting_ (para não ser barrado por _rate limiting_ quando realizar os testes de carga) no objeto _Ingress_;
```
$ kubectl apply -f infra/kong-k8s/misc/apis/brewery-api.yaml
```

21. Verificar se o _ServiceMonitor_ está habilitado na instalação;
```
$ kubectl get servicemonitor -n kong

NAME        AGE
kong-kong   138m
```

22. Acessar o _Grafana_ via _port-forward_; (Username: admin / Password: prom-operator)
```
$ kubectl port-forward svc/prometheus-stack-grafana 3000:80 -n monitoring
```

23. Importar o _dashboard_ do _Kong_ (código 7424);
- Abrir os gráficos de _Request Rate_;

![Grafana - Tela inicial](./images/grafana-tela-inicial.png)

Pode-se verificar que não há métricas ainda, porque não foram rodados os testes de carga.

24. Criar o teste de carga;
```
$ cd infra/load/infra
$ ./load.sh

#!/bin/bash
kubectl testkube create test --file ../create_brewery_load.js --type k6/script --name create-brewery-load
kubectl testkube run test create-brewery-load -f
```

25. Verificar a execução do teste de carga;
```
$ kubectl get po -n testkube
$ kubectl logs 6487b85bd5875516d25437ed-dxxgs -f -n testkube

{"type":"line","content":"\nrunning (0m00.9s), 001/200 VUs, 0 complete and 0 interrupted iterations\ndefault   [   0% ] 001/200 VUs  0m00.8s/5m10.0s\n","time":"2023-06-22T01:46:07.091329172Z"}
{"type":"line","content":"\nrunning (0m01.9s), 001/200 VUs, 5 complete and 0 interrupted iterations\ndefault   [   1% ] 001/200 VUs  0m01.8s/5m10.0s\n","time":"2023-06-22T01:46:08.091521205Z"}
{"type":"line","content":"\nrunning (0m02.9s), 001/200 VUs, 16 complete and 0 interrupted iterations\ndefault   [   1% ] 001/200 VUs  0m02.8s/5m10.0s\n","time":"2023-06-22T01:46:09.090666913Z"}
{"type":"line","content":"\nrunning (0m03.9s), 001/200 VUs, 27 complete and 0 interrupted iterations\ndefault   [   1% ] 001/200 VUs  0m03.8s/5m10.0s\n","time":"2023-06-22T01:46:10.096621435Z"}
{"type":"line","content":"\nrunning (0m04.9s), 001/200 VUs, 41 complete and 0 interrupted iterations\ndefault   [   2% ] 001/200 VUs  0m04.8s/5m10.0s\n","time":"2023-06-22T01:46:11.091232188Z"}
{"type":"line","content":"\nrunning (0m05.9s), 001/200 VUs, 57 complete and 0 interrupted iterations\ndefault   [   2% ] 001/200 VUs  0m05.8s/5m10.0s\n","time":"2023-06-22T01:46:12.091641183Z"}
{"type":"line","content":"\nrunning (0m06.9s), 001/200 VUs, 59 complete and 0 interrupted iterations\ndefault   [   2% ] 001/200 VUs  0m06.8s/5m10.0s\n","time":"2023-06-22T01:46:13.091234834Z"}
{"type":"line","content":"\nrunning (0m07.9s), 001/200 VUs, 61 complete and 0 interrupted iterations\ndefault   [   3% ] 001/200 VUs  0m07.8s/5m10.0s\n","time":"2023-06-22T01:46:14.091096086Z"}
{"type":"line","content":"\nrunning (0m08.9s), 001/200 VUs, 72 complete and 0 interrupted iterations\ndefault   [   3% ] 001/200 VUs  0m08.8s/5m10.0s\n","time":"2023-06-22T01:46:15.091616386Z"}
{"type":"line","content":"\nrunning (0m09.9s), 001/200 VUs, 96 complete and 0 interrupted iterations\ndefault   [   3% ] 001/200 VUs  0m09.8s/5m10.0s\n","time":"2023-06-22T01:46:16.090772938Z"}
{"type":"line","content":"\nrunning (0m10.9s), 000/200 VUs, 103 complete and 0 interrupted iterations\ndefault   [   3% ] 000/200 VUs  0m10.8s/5m10.0s\n","time":"2023-06-22T01:46:17.090622922Z"}
{"type":"line","content":"\nrunning (0m11.9s), 001/200 VUs, 126 complete and 0 interrupted iterations\ndefault   [   4% ] 001/200 VUs  0m11.8s/5m10.0s\n","time":"2023-06-22T01:46:18.09062593Z"}
{"type":"line","content":"\nrunning (0m12.9s), 002/200 VUs, 157 complete and 0 interrupted iterations\ndefault   [   4% ] 002/200 VUs  0m12.8s/5m10.0s\n","time":"2023-06-22T01:46:19.090997967Z"}
{"type":"line","content":"\nrunning (0m13.9s), 003/200 VUs, 191 complete and 0 interrupted iterations\ndefault   [   4% ] 003/200 VUs  0m13.8s/5m10.0s\n","time":"2023-06-22T01:46:20.090693972Z"}
{"type":"line","content":"\nrunning (0m14.9s), 003/200 VUs, 232 complete and 0 interrupted iterations\ndefault   [   5% ] 003/200 VUs  0m14.8s/5m10.0s\n","time":"2023-06-22T01:46:21.091271378Z"}
{"type":"line","content":"\nrunning (0m15.9s), 004/200 VUs, 281 complete and 0 interrupted iterations\ndefault   [   5% ] 004/200 VUs  0m15.8s/5m10.0s\n","time":"2023-06-22T01:46:22.090830026Z"}
{"type":"line","content":"\nrunning (0m16.9s), 005/200 VUs, 334 complete and 0 interrupted iterations\ndefault   [   5% ] 005/200 VUs  0m16.8s/5m10.0s\n","time":"2023-06-22T01:46:23.091354204Z"}
{"type":"line","content":"\nrunning (0m17.9s), 006/200 VUs, 385 complete and 0 interrupted iterations\ndefault   [   6% ] 006/200 VUs  0m17.8s/5m10.0s\n","time":"2023-06-22T01:46:24.090822429Z"}
{"type":"line","content":"\nrunning (0m18.9s), 007/200 VUs, 450 complete and 0 interrupted iterations\ndefault   [   6% ] 007/200 VUs  0m18.8s/5m10.0s\n","time":"2023-06-22T01:46:25.090871282Z"}
{"type":"line","content":"\nrunning (0m19.9s), 008/200 VUs, 529 complete and 0 interrupted iterations\ndefault   [   6% ] 008/200 VUs  0m19.8s/5m10.0s\n","time":"2023-06-22T01:46:26.091273584Z"}
{"type":"line","content":"\nrunning (0m20.9s), 008/200 VUs, 610 complete and 0 interrupted iterations\ndefault   [   7% ] 008/200 VUs  0m20.8s/5m10.0s\n","time":"2023-06-22T01:46:27.091252383Z"}
{"type":"line","content":"\nrunning (0m21.9s), 009/200 VUs, 701 complete and 0 interrupted iterations\ndefault   [   7% ] 009/200 VUs  0m21.8s/5m10.0s\n","time":"2023-06-22T01:46:28.091167797Z"}
{"type":"line","content":"\nrunning (0m22.9s), 010/200 VUs, 793 complete and 0 interrupted iterations\ndefault   [   7% ] 010/200 VUs  0m22.8s/5m10.0s\n","time":"2023-06-22T01:46:29.090732313Z"}
{"type":"line","content":"\nrunning (0m23.9s), 011/200 VUs, 900 complete and 0 interrupted iterations\ndefault   [   8% ] 011/200 VUs  0m23.8s/5m10.0s\n","time":"2023-06-22T01:46:30.135007861Z"}
{"type":"line","content":"\nrunning (0m24.9s), 012/200 VUs, 1017 complete and 0 interrupted iterations\ndefault   [   8% ] 012/200 VUs  0m24.8s/5m10.0s\n","time":"2023-06-22T01:46:31.0911305Z"}
{"type":"line","content":"\nrunning (0m25.9s), 013/200 VUs, 1120 complete and 0 interrupted iterations\ndefault   [   8% ] 013/200 VUs  0m25.8s/5m10.0s\n","time":"2023-06-22T01:46:32.09140848Z"}
{"type":"line","content":"\nrunning (0m26.9s), 013/200 VUs, 1120 complete and 0 interrupted iterations\ndefault   [   9% ] 013/200 VUs  0m26.8s/5m10.0s\n","time":"2023-06-22T01:46:33.091035314Z"}
{"type":"line","content":"\nrunning (0m27.9s), 014/200 VUs, 1124 complete and 0 interrupted iterations\ndefault   [   9% ] 014/200 VUs  0m27.8s/5m10.0s\n","time":"2023-06-22T01:46:34.091560175Z"}
{"type":"line","content":"\nrunning (0m28.9s), 015/200 VUs, 1131 complete and 0 interrupted iterations\ndefault   [   9% ] 015/200 VUs  0m28.8s/5m10.0s\n","time":"2023-06-22T01:46:35.091446432Z"}
{"type":"line","content":"\nrunning (0m29.9s), 016/200 VUs, 1258 complete and 0 interrupted iterations\ndefault   [  10% ] 016/200 VUs  0m29.8s/5m10.0s\n","time":"2023-06-22T01:46:36.091400262Z"}
{"type":"line","content":"\nrunning (0m30.9s), 017/200 VUs, 1389 complete and 0 interrupted iterations\ndefault   [  10% ] 017/200 VUs  0m30.8s/5m10.0s\n","time":"2023-06-22T01:46:37.090624137Z"}
{"type":"line","content":"\nrunning (0m31.9s), 018/200 VUs, 1511 complete and 0 interrupted iterations\ndefault   [  10% ] 018/200 VUs  0m31.8s/5m10.0s\n","time":"2023-06-22T01:46:38.091584116Z"}
{"type":"line","content":"\nrunning (0m32.9s), 018/200 VUs, 1631 complete and 0 interrupted iterations\ndefault   [  11% ] 018/200 VUs  0m32.8s/5m10.0s\n","time":"2023-06-22T01:46:39.090623891Z"}
{"type":"line","content":"\nrunning (0m33.9s), 019/200 VUs, 1745 complete and 0 interrupted iterations\ndefault   [  11% ] 019/200 VUs  0m33.8s/5m10.0s\n","time":"2023-06-22T01:46:40.11218787Z"}
{"type":"line","content":"\nrunning (0m34.9s), 020/200 VUs, 1893 complete and 0 interrupted iterations\ndefault   [  11% ] 020/200 VUs  0m34.8s/5m10.0s\n","time":"2023-06-22T01:46:41.091387595Z"}
{"type":"line","content":"\nrunning (0m35.9s), 021/200 VUs, 2031 complete and 0 interrupted iterations\ndefault   [  12% ] 021/200 VUs  0m35.8s/5m10.0s\n","time":"2023-06-22T01:46:42.090926002Z"}
{"type":"line","content":"\nrunning (0m36.9s), 022/200 VUs, 2181 complete and 0 interrupted iterations\ndefault   [  12% ] 022/200 VUs  0m36.8s/5m10.0s\n","time":"2023-06-22T01:46:43.090836739Z"}
{"type":"line","content":"\nrunning (0m37.9s), 023/200 VUs, 2315 complete and 0 interrupted iterations\ndefault   [  12% ] 023/200 VUs  0m37.8s/5m10.0s\n","time":"2023-06-22T01:46:44.091337671Z"}
{"type":"line","content":"\nrunning (0m38.9s), 023/200 VUs, 2458 complete and 0 interrupted iterations\ndefault   [  13% ] 023/200 VUs  0m38.8s/5m10.0s\n","time":"2023-06-22T01:46:45.09065299Z"}
{"type":"line","content":"\nrunning (0m39.9s), 024/200 VUs, 2597 complete and 0 interrupted iterations\ndefault   [  13% ] 024/200 VUs  0m39.8s/5m10.0s\n","time":"2023-06-22T01:46:46.114329162Z"}
{"type":"line","content":"\nrunning (0m40.9s), 025/200 VUs, 2748 complete and 0 interrupted iterations\ndefault   [  13% ] 025/200 VUs  0m40.8s/5m10.0s\n","time":"2023-06-22T01:46:47.091150458Z"}
{"type":"line","content":"\nrunning (0m41.9s), 026/200 VUs, 2892 complete and 0 interrupted iterations\ndefault   [  13% ] 026/200 VUs  0m41.8s/5m10.0s\n","time":"2023-06-22T01:46:48.091611251Z"}
{"type":"line","content":"\nrunning (0m42.9s), 027/200 VUs, 3057 complete and 0 interrupted iterations\ndefault   [  14% ] 027/200 VUs  0m42.8s/5m10.0s\n","time":"2023-06-22T01:46:49.091246717Z"}
{"type":"line","content":"\nrunning (0m43.9s), 028/200 VUs, 3214 complete and 0 interrupted iterations\ndefault   [  14% ] 028/200 VUs  0m43.8s/5m10.0s\n","time":"2023-06-22T01:46:50.098329113Z"}
{"type":"line","content":"\nrunning (0m44.9s), 028/200 VUs, 3368 complete and 0 interrupted iterations\ndefault   [  14% ] 028/200 VUs  0m44.8s/5m10.0s\n","time":"2023-06-22T01:46:51.090827669Z"}
{"type":"line","content":"\nrunning (0m45.9s), 029/200 VUs, 3524 complete and 0 interrupted iterations\ndefault   [  15% ] 029/200 VUs  0m45.8s/5m10.0s\n","time":"2023-06-22T01:46:52.091381114Z"}
{"type":"line","content":"\nrunning (0m46.9s), 030/200 VUs, 3524 complete and 0 interrupted iterations\ndefault   [  15% ] 030/200 VUs  0m46.8s/5m10.0s\n","time":"2023-06-22T01:46:53.090644966Z"}
{"type":"line","content":"\nrunning (0m47.9s), 031/200 VUs, 3537 complete and 0 interrupted iterations\ndefault   [  15% ] 031/200 VUs  0m47.8s/5m10.0s\n","time":"2023-06-22T01:46:54.091678177Z"}
{"type":"line","content":"\nrunning (0m48.9s), 032/200 VUs, 3657 complete and 0 interrupted iterations\ndefault   [  16% ] 032/200 VUs  0m48.8s/5m10.0s\n","time":"2023-06-22T01:46:55.091329294Z"}
{"type":"line","content":"\nrunning (0m49.9s), 033/200 VUs, 3661 complete and 0 interrupted iterations\ndefault   [  16% ] 033/200 VUs  0m49.8s/5m10.0s\n","time":"2023-06-22T01:46:56.091012675Z"}
{"type":"line","content":"\nrunning (0m50.9s), 033/200 VUs, 3805 complete and 0 interrupted iterations\ndefault   [  16% ] 033/200 VUs  0m50.8s/5m10.0s\n","time":"2023-06-22T01:46:57.091417383Z"}
{"type":"line","content":"\nrunning (0m51.9s), 034/200 VUs, 3967 complete and 0 interrupted iterations\ndefault   [  17% ] 034/200 VUs  0m51.8s/5m10.0s\n","time":"2023-06-22T01:46:58.091234867Z"}
{"type":"line","content":"\nrunning (0m52.9s), 035/200 VUs, 4150 complete and 0 interrupted iterations\ndefault   [  17% ] 035/200 VUs  0m52.8s/5m10.0s\n","time":"2023-06-22T01:46:59.091050183Z"}
{"type":"line","content":"\nrunning (0m53.9s), 036/200 VUs, 4281 complete and 0 interrupted iterations\ndefault   [  17% ] 036/200 VUs  0m53.8s/5m10.0s\n","time":"2023-06-22T01:47:00.131653537Z"}
{"type":"line","content":"\nrunning (0m54.9s), 037/200 VUs, 4417 complete and 0 interrupted iterations\ndefault   [  18% ] 037/200 VUs  0m54.8s/5m10.0s\n","time":"2023-06-22T01:47:01.090701888Z"}
{"type":"line","content":"\nrunning (0m55.9s), 038/200 VUs, 4592 complete and 0 interrupted iterations\ndefault   [  18% ] 038/200 VUs  0m55.8s/5m10.0s\n","time":"2023-06-22T01:47:02.091200533Z"}
{"type":"line","content":"\nrunning (0m56.9s), 038/200 VUs, 4719 complete and 0 interrupted iterations\ndefault   [  18% ] 038/200 VUs  0m56.8s/5m10.0s\n","time":"2023-06-22T01:47:03.090727866Z"}
{"type":"line","content":"\nrunning (0m57.9s), 039/200 VUs, 4917 complete and 0 interrupted iterations\ndefault   [  19% ] 039/200 VUs  0m57.8s/5m10.0s\n","time":"2023-06-22T01:47:04.090637403Z"}
{"type":"line","content":"\nrunning (0m58.9s), 040/200 VUs, 5109 complete and 0 interrupted iterations\ndefault   [  19% ] 040/200 VUs  0m58.8s/5m10.0s\n","time":"2023-06-22T01:47:05.090707724Z"}
{"type":"line","content":"\nrunning (0m59.9s), 041/200 VUs, 5304 complete and 0 interrupted iterations\ndefault   [  19% ] 041/200 VUs  0m59.8s/5m10.0s\n","time":"2023-06-22T01:47:06.091602301Z"}
{"type":"line","content":"\nrunning (1m00.9s), 042/200 VUs, 5524 complete and 0 interrupted iterations\ndefault   [  20% ] 042/200 VUs  1m00.8s/5m10.0s\n","time":"2023-06-22T01:47:07.091506835Z"}
{"type":"line","content":"\nrunning (1m01.9s), 043/200 VUs, 5713 complete and 0 interrupted iterations\ndefault   [  20% ] 043/200 VUs  1m01.8s/5m10.0s\n","time":"2023-06-22T01:47:08.147031508Z"}
{"type":"line","content":"\nrunning (1m02.9s), 043/200 VUs, 5880 complete and 0 interrupted iterations\ndefault   [  20% ] 043/200 VUs  1m02.8s/5m10.0s\n","time":"2023-06-22T01:47:09.090681852Z"}
{"type":"line","content":"\nrunning (1m03.9s), 044/200 VUs, 6082 complete and 0 interrupted iterations\ndefault   [  21% ] 044/200 VUs  1m03.8s/5m10.0s\n","time":"2023-06-22T01:47:10.097730862Z"}
{"type":"line","content":"\nrunning (1m04.9s), 045/200 VUs, 6283 complete and 0 interrupted iterations\ndefault   [  21% ] 045/200 VUs  1m04.8s/5m10.0s\n","time":"2023-06-22T01:47:11.091197511Z"}
{"type":"line","content":"\nrunning (1m05.9s), 046/200 VUs, 6455 complete and 0 interrupted iterations\ndefault   [  21% ] 046/200 VUs  1m05.8s/5m10.0s\n","time":"2023-06-22T01:47:12.091381984Z"}
{"type":"line","content":"\nrunning (1m06.9s), 047/200 VUs, 6529 complete and 0 interrupted iterations\ndefault   [  22% ] 047/200 VUs  1m06.8s/5m10.0s\n","time":"2023-06-22T01:47:13.091240907Z"}
{"type":"line","content":"\nrunning (1m07.9s), 048/200 VUs, 6589 complete and 0 interrupted iterations\ndefault   [  22% ] 048/200 VUs  1m07.8s/5m10.0s\n","time":"2023-06-22T01:47:14.09111362Z"}
{"type":"line","content":"\nrunning (1m08.9s), 048/200 VUs, 6650 complete and 0 interrupted iterations\ndefault   [  22% ] 048/200 VUs  1m08.8s/5m10.0s\n","time":"2023-06-22T01:47:15.090742781Z"}
{"type":"line","content":"\nrunning (1m09.9s), 049/200 VUs, 6711 complete and 0 interrupted iterations\ndefault   [  23% ] 049/200 VUs  1m09.8s/5m10.0s\n","time":"2023-06-22T01:47:16.09083253Z"}
{"type":"line","content":"\nrunning (1m10.9s), 050/200 VUs, 6869 complete and 0 interrupted iterations\ndefault   [  23% ] 050/200 VUs  1m10.8s/5m10.0s\n","time":"2023-06-22T01:47:17.09111186Z"}
{"type":"line","content":"\nrunning (1m11.9s), 051/200 VUs, 7029 complete and 0 interrupted iterations\ndefault   [  23% ] 051/200 VUs  1m11.8s/5m10.0s\n","time":"2023-06-22T01:47:18.090776457Z"}
{"type":"line","content":"\nrunning (1m12.9s), 052/200 VUs, 7255 complete and 0 interrupted iterations\ndefault   [  23% ] 052/200 VUs  1m12.8s/5m10.0s\n","time":"2023-06-22T01:47:19.09155399Z"}
{"type":"line","content":"\nrunning (1m13.9s), 053/200 VUs, 7476 complete and 0 interrupted iterations\ndefault   [  24% ] 053/200 VUs  1m13.8s/5m10.0s\n","time":"2023-06-22T01:47:20.091606306Z"}
{"type":"line","content":"\nrunning (1m14.9s), 053/200 VUs, 7702 complete and 0 interrupted iterations\ndefault   [  24% ] 053/200 VUs  1m14.8s/5m10.0s\n","time":"2023-06-22T01:47:21.091145992Z"}
{"type":"line","content":"\nrunning (1m15.9s), 054/200 VUs, 7927 complete and 0 interrupted iterations\ndefault   [  24% ] 054/200 VUs  1m15.8s/5m10.0s\n","time":"2023-06-22T01:47:22.091123824Z"}
{"type":"line","content":"\nrunning (1m16.9s), 055/200 VUs, 8127 complete and 0 interrupted iterations\ndefault   [  25% ] 055/200 VUs  1m16.8s/5m10.0s\n","time":"2023-06-22T01:47:23.090622278Z"}
{"type":"line","content":"\nrunning (1m17.9s), 056/200 VUs, 8338 complete and 0 interrupted iterations\ndefault   [  25% ] 056/200 VUs  1m17.8s/5m10.0s\n","time":"2023-06-22T01:47:24.091271796Z"}
{"type":"line","content":"\nrunning (1m18.9s), 057/200 VUs, 8603 complete and 0 interrupted iterations\ndefault   [  25% ] 057/200 VUs  1m18.8s/5m10.0s\n","time":"2023-06-22T01:47:25.090816441Z"}
{"type":"line","content":"\nrunning (1m19.9s), 058/200 VUs, 8863 complete and 0 interrupted iterations\ndefault   [  26% ] 058/200 VUs  1m19.8s/5m10.0s\n","time":"2023-06-22T01:47:26.091202419Z"}
{"type":"line","content":"\nrunning (1m20.9s), 058/200 VUs, 9127 complete and 0 interrupted iterations\ndefault   [  26% ] 058/200 VUs  1m20.8s/5m10.0s\n","time":"2023-06-22T01:47:27.091604815Z"}
{"type":"line","content":"\nrunning (1m21.9s), 059/200 VUs, 9387 complete and 0 interrupted iterations\ndefault   [  26% ] 059/200 VUs  1m21.8s/5m10.0s\n","time":"2023-06-22T01:47:28.090665367Z"}
{"type":"line","content":"\nrunning (1m22.9s), 060/200 VUs, 9670 complete and 0 interrupted iterations\ndefault   [  27% ] 060/200 VUs  1m22.8s/5m10.0s\n","time":"2023-06-22T01:47:29.091215201Z"}
{"type":"line","content":"\nrunning (1m23.9s), 061/200 VUs, 9923 complete and 0 interrupted iterations\ndefault   [  27% ] 061/200 VUs  1m23.8s/5m10.0s\n","time":"2023-06-22T01:47:30.094708626Z"}
{"type":"line","content":"\nrunning (1m24.9s), 062/200 VUs, 10166 complete and 0 interrupted iterations\ndefault   [  27% ] 062/200 VUs  1m24.8s/5m10.0s\n","time":"2023-06-22T01:47:31.090842702Z"}
{"type":"line","content":"\nrunning (1m25.9s), 063/200 VUs, 10356 complete and 0 interrupted iterations\ndefault   [  28% ] 063/200 VUs  1m25.8s/5m10.0s\n","time":"2023-06-22T01:47:32.090693627Z"}
{"type":"line","content":"\nrunning (1m26.9s), 063/200 VUs, 10511 complete and 0 interrupted iterations\ndefault   [  28% ] 063/200 VUs  1m26.8s/5m10.0s\n","time":"2023-06-22T01:47:33.090652375Z"}
{"type":"line","content":"\nrunning (1m27.9s), 064/200 VUs, 10629 complete and 0 interrupted iterations\ndefault   [  28% ] 064/200 VUs  1m27.8s/5m10.0s\n","time":"2023-06-22T01:47:34.094121522Z"}
{"type":"line","content":"\nrunning (1m28.9s), 065/200 VUs, 10739 complete and 0 interrupted iterations\ndefault   [  29% ] 065/200 VUs  1m28.8s/5m10.0s\n","time":"2023-06-22T01:47:35.090630487Z"}
{"type":"line","content":"\nrunning (1m29.9s), 066/200 VUs, 10828 complete and 0 interrupted iterations\ndefault   [  29% ] 066/200 VUs  1m29.8s/5m10.0s\n","time":"2023-06-22T01:47:36.090870258Z"}
{"type":"line","content":"\nrunning (1m30.9s), 067/200 VUs, 10999 complete and 0 interrupted iterations\ndefault   [  29% ] 067/200 VUs  1m30.8s/5m10.0s\n","time":"2023-06-22T01:47:37.091401157Z"}
{"type":"line","content":"\nrunning (1m31.9s), 068/200 VUs, 11221 complete and 0 interrupted iterations\ndefault   [  30% ] 068/200 VUs  1m31.8s/5m10.0s\n","time":"2023-06-22T01:47:38.091181215Z"}
{"type":"line","content":"\nrunning (1m32.9s), 068/200 VUs, 11430 complete and 0 interrupted iterations\ndefault   [  30% ] 068/200 VUs  1m32.8s/5m10.0s\n","time":"2023-06-22T01:47:39.090623468Z"}
{"type":"line","content":"\nrunning (1m33.9s), 069/200 VUs, 11569 complete and 0 interrupted iterations\ndefault   [  30% ] 069/200 VUs  1m33.8s/5m10.0s\n","time":"2023-06-22T01:47:40.186679129Z"}
{"type":"line","content":"\nrunning (1m34.9s), 070/200 VUs, 11837 complete and 0 interrupted iterations\ndefault   [  31% ] 070/200 VUs  1m34.8s/5m10.0s\n","time":"2023-06-22T01:47:41.090645658Z"}
{"type":"line","content":"\nrunning (1m35.9s), 071/200 VUs, 12071 complete and 0 interrupted iterations\ndefault   [  31% ] 071/200 VUs  1m35.8s/5m10.0s\n","time":"2023-06-22T01:47:42.09094589Z"}
{"type":"line","content":"\nrunning (1m36.9s), 072/200 VUs, 12319 complete and 0 interrupted iterations\ndefault   [  31% ] 072/200 VUs  1m36.8s/5m10.0s\n","time":"2023-06-22T01:47:43.090899528Z"}
{"type":"line","content":"\nrunning (1m37.9s), 073/200 VUs, 12535 complete and 0 interrupted iterations\ndefault   [  32% ] 073/200 VUs  1m37.8s/5m10.0s\n","time":"2023-06-22T01:47:44.090985618Z"}
{"type":"line","content":"\nrunning (1m38.9s), 073/200 VUs, 12774 complete and 0 interrupted iterations\ndefault   [  32% ] 073/200 VUs  1m38.8s/5m10.0s\n","time":"2023-06-22T01:47:45.091575592Z"}
{"type":"line","content":"\nrunning (1m39.9s), 074/200 VUs, 13067 complete and 0 interrupted iterations\ndefault   [  32% ] 074/200 VUs  1m39.8s/5m10.0s\n","time":"2023-06-22T01:47:46.091295725Z"}
{"type":"line","content":"\nrunning (1m40.9s), 075/200 VUs, 13323 complete and 0 interrupted iterations\ndefault   [  33% ] 075/200 VUs  1m40.8s/5m10.0s\n","time":"2023-06-22T01:47:47.091435927Z"}
{"type":"line","content":"\nrunning (1m41.9s), 076/200 VUs, 13605 complete and 0 interrupted iterations\ndefault   [  33% ] 076/200 VUs  1m41.8s/5m10.0s\n","time":"2023-06-22T01:47:48.091008606Z"}
{"type":"line","content":"\nrunning (1m42.9s), 077/200 VUs, 13887 complete and 0 interrupted iterations\ndefault   [  33% ] 077/200 VUs  1m42.8s/5m10.0s\n","time":"2023-06-22T01:47:49.091651077Z"}
{"type":"line","content":"\nrunning (1m43.9s), 078/200 VUs, 14134 complete and 0 interrupted iterations\ndefault   [  33% ] 078/200 VUs  1m43.8s/5m10.0s\n","time":"2023-06-22T01:47:50.090591483Z"}
{"type":"line","content":"\nrunning (1m44.9s), 078/200 VUs, 14394 complete and 0 interrupted iterations\ndefault   [  34% ] 078/200 VUs  1m44.8s/5m10.0s\n","time":"2023-06-22T01:47:51.090680464Z"}
{"type":"line","content":"\nrunning (1m45.9s), 079/200 VUs, 14621 complete and 0 interrupted iterations\ndefault   [  34% ] 079/200 VUs  1m45.8s/5m10.0s\n","time":"2023-06-22T01:47:52.091596305Z"}
{"type":"line","content":"\nrunning (1m46.9s), 080/200 VUs, 14688 complete and 0 interrupted iterations\ndefault   [  34% ] 080/200 VUs  1m46.8s/5m10.0s\n","time":"2023-06-22T01:47:53.091613685Z"}
{"type":"line","content":"\nrunning (1m47.9s), 081/200 VUs, 14700 complete and 0 interrupted iterations\ndefault   [  35% ] 081/200 VUs  1m47.8s/5m10.0s\n","time":"2023-06-22T01:47:54.090606909Z"}
{"type":"line","content":"\nrunning (1m48.9s), 082/200 VUs, 14840 complete and 0 interrupted iterations\ndefault   [  35% ] 082/200 VUs  1m48.8s/5m10.0s\n","time":"2023-06-22T01:47:55.091144606Z"}
{"type":"line","content":"\nrunning (1m49.9s), 083/200 VUs, 14972 complete and 0 interrupted iterations\ndefault   [  35% ] 083/200 VUs  1m49.8s/5m10.0s\n","time":"2023-06-22T01:47:56.095053972Z"}
{"type":"line","content":"\nrunning (1m50.9s), 083/200 VUs, 14990 complete and 0 interrupted iterations\ndefault   [  36% ] 083/200 VUs  1m50.8s/5m10.0s\n","time":"2023-06-22T01:47:57.091329575Z"}
{"type":"line","content":"\nrunning (1m51.9s), 084/200 VUs, 15140 complete and 0 interrupted iterations\ndefault   [  36% ] 084/200 VUs  1m51.8s/5m10.0s\n","time":"2023-06-22T01:47:58.090625655Z"}
{"type":"line","content":"\nrunning (1m52.9s), 085/200 VUs, 15347 complete and 0 interrupted iterations\ndefault   [  36% ] 085/200 VUs  1m52.8s/5m10.0s\n","time":"2023-06-22T01:47:59.090693096Z"}
{"type":"line","content":"\nrunning (1m53.9s), 086/200 VUs, 15627 complete and 0 interrupted iterations\ndefault   [  37% ] 086/200 VUs  1m53.8s/5m10.0s\n","time":"2023-06-22T01:48:00.09601713Z"}
{"type":"line","content":"\nrunning (1m54.9s), 087/200 VUs, 15855 complete and 0 interrupted iterations\ndefault   [  37% ] 087/200 VUs  1m54.8s/5m10.0s\n","time":"2023-06-22T01:48:01.091182654Z"}
{"type":"line","content":"\nrunning (1m55.9s), 088/200 VUs, 16079 complete and 0 interrupted iterations\ndefault   [  37% ] 088/200 VUs  1m55.8s/5m10.0s\n","time":"2023-06-22T01:48:02.091649829Z"}
{"type":"line","content":"\nrunning (1m56.9s), 088/200 VUs, 16239 complete and 0 interrupted iterations\ndefault   [  38% ] 088/200 VUs  1m56.8s/5m10.0s\n","time":"2023-06-22T01:48:03.091707562Z"}
{"type":"line","content":"\nrunning (1m57.9s), 089/200 VUs, 16439 complete and 0 interrupted iterations\ndefault   [  38% ] 089/200 VUs  1m57.8s/5m10.0s\n","time":"2023-06-22T01:48:04.090651487Z"}
{"type":"line","content":"\nrunning (1m58.9s), 090/200 VUs, 16674 complete and 0 interrupted iterations\ndefault   [  38% ] 090/200 VUs  1m58.8s/5m10.0s\n","time":"2023-06-22T01:48:05.091231736Z"}
{"type":"line","content":"\nrunning (1m59.9s), 091/200 VUs, 16948 complete and 0 interrupted iterations\ndefault   [  39% ] 091/200 VUs  1m59.8s/5m10.0s\n","time":"2023-06-22T01:48:06.090973373Z"}
{"type":"line","content":"\nrunning (2m00.9s), 092/200 VUs, 17224 complete and 0 interrupted iterations\ndefault   [  39% ] 092/200 VUs  2m00.8s/5m10.0s\n","time":"2023-06-22T01:48:07.090883681Z"}
{"type":"line","content":"\nrunning (2m01.9s), 093/200 VUs, 17537 complete and 0 interrupted iterations\ndefault   [  39% ] 093/200 VUs  2m01.8s/5m10.0s\n","time":"2023-06-22T01:48:08.092281767Z"}
{"type":"line","content":"\nrunning (2m02.9s), 093/200 VUs, 17844 complete and 0 interrupted iterations\ndefault   [  40% ] 093/200 VUs  2m02.8s/5m10.0s\n","time":"2023-06-22T01:48:09.090841059Z"}
{"type":"line","content":"\nrunning (2m03.9s), 094/200 VUs, 18167 complete and 0 interrupted iterations\ndefault   [  40% ] 094/200 VUs  2m03.8s/5m10.0s\n","time":"2023-06-22T01:48:10.10313829Z"}
{"type":"line","content":"\nrunning (2m04.9s), 095/200 VUs, 18561 complete and 0 interrupted iterations\ndefault   [  40% ] 095/200 VUs  2m04.8s/5m10.0s\n","time":"2023-06-22T01:48:11.091556724Z"}
{"type":"line","content":"\nrunning (2m05.9s), 096/200 VUs, 18857 complete and 0 interrupted iterations\ndefault   [  41% ] 096/200 VUs  2m05.8s/5m10.0s\n","time":"2023-06-22T01:48:12.091409689Z"}
{"type":"line","content":"\nrunning (2m06.9s), 097/200 VUs, 18858 complete and 0 interrupted iterations\ndefault   [  41% ] 097/200 VUs  2m06.8s/5m10.0s\n","time":"2023-06-22T01:48:13.09137323Z"}
{"type":"line","content":"\nrunning (2m07.9s), 098/200 VUs, 18858 complete and 0 interrupted iterations\ndefault   [  41% ] 098/200 VUs  2m07.8s/5m10.0s\n","time":"2023-06-22T01:48:14.091394047Z"}
{"type":"line","content":"\nrunning (2m08.9s), 098/200 VUs, 19010 complete and 0 interrupted iterations\ndefault   [  42% ] 098/200 VUs  2m08.8s/5m10.0s\n","time":"2023-06-22T01:48:15.092082487Z"}
{"type":"line","content":"\nrunning (2m09.9s), 099/200 VUs, 19061 complete and 0 interrupted iterations\ndefault   [  42% ] 099/200 VUs  2m09.8s/5m10.0s\n","time":"2023-06-22T01:48:16.090644331Z"}
{"type":"line","content":"\nrunning (2m10.9s), 100/200 VUs, 19192 complete and 0 interrupted iterations\ndefault   [  42% ] 100/200 VUs  2m10.8s/5m10.0s\n","time":"2023-06-22T01:48:17.091217327Z"}
{"type":"line","content":"\nrunning (2m11.9s), 100/200 VUs, 19496 complete and 0 interrupted iterations\ndefault   [  43% ] 100/200 VUs  2m11.8s/5m10.0s\n","time":"2023-06-22T01:48:18.095680803Z"}
{"type":"line","content":"\nrunning (2m12.9s), 101/200 VUs, 19850 complete and 0 interrupted iterations\ndefault   [  43% ] 101/200 VUs  2m12.8s/5m10.0s\n","time":"2023-06-22T01:48:19.090818837Z"}
{"type":"line","content":"\nrunning (2m13.9s), 102/200 VUs, 20141 complete and 0 interrupted iterations\ndefault   [  43% ] 102/200 VUs  2m13.8s/5m10.0s\n","time":"2023-06-22T01:48:20.092719358Z"}
{"type":"line","content":"\nrunning (2m14.9s), 102/200 VUs, 20361 complete and 0 interrupted iterations\ndefault   [  43% ] 102/200 VUs  2m14.8s/5m10.0s\n","time":"2023-06-22T01:48:21.091569432Z"}
{"type":"line","content":"\nrunning (2m15.9s), 103/200 VUs, 20644 complete and 0 interrupted iterations\ndefault   [  44% ] 103/200 VUs  2m15.8s/5m10.0s\n","time":"2023-06-22T01:48:22.091653249Z"}
{"type":"line","content":"\nrunning (2m16.9s), 103/200 VUs, 20865 complete and 0 interrupted iterations\ndefault   [  44% ] 103/200 VUs  2m16.8s/5m10.0s\n","time":"2023-06-22T01:48:23.090955133Z"}
{"type":"line","content":"\nrunning (2m17.9s), 104/200 VUs, 21153 complete and 0 interrupted iterations\ndefault   [  44% ] 104/200 VUs  2m17.8s/5m10.0s\n","time":"2023-06-22T01:48:24.09160487Z"}
{"type":"line","content":"\nrunning (2m18.9s), 104/200 VUs, 21366 complete and 0 interrupted iterations\ndefault   [  45% ] 104/200 VUs  2m18.8s/5m10.0s\n","time":"2023-06-22T01:48:25.091251336Z"}
{"type":"line","content":"\nrunning (2m19.9s), 105/200 VUs, 21689 complete and 0 interrupted iterations\ndefault   [  45% ] 105/200 VUs  2m19.8s/5m10.0s\n","time":"2023-06-22T01:48:26.091310307Z"}
{"type":"line","content":"\nrunning (2m20.9s), 105/200 VUs, 22059 complete and 0 interrupted iterations\ndefault   [  45% ] 105/200 VUs  2m20.8s/5m10.0s\n","time":"2023-06-22T01:48:27.090776795Z"}
{"type":"line","content":"\nrunning (2m21.9s), 106/200 VUs, 22442 complete and 0 interrupted iterations\ndefault   [  46% ] 106/200 VUs  2m21.8s/5m10.0s\n","time":"2023-06-22T01:48:28.090689964Z"}
{"type":"line","content":"\nrunning (2m22.9s), 107/200 VUs, 22835 complete and 0 interrupted iterations\ndefault   [  46% ] 107/200 VUs  2m22.8s/5m10.0s\n","time":"2023-06-22T01:48:29.090868217Z"}
{"type":"line","content":"\nrunning (2m23.9s), 107/200 VUs, 23181 complete and 0 interrupted iterations\ndefault   [  46% ] 107/200 VUs  2m23.8s/5m10.0s\n","time":"2023-06-22T01:48:30.091058637Z"}
{"type":"line","content":"\nrunning (2m24.9s), 108/200 VUs, 23568 complete and 0 interrupted iterations\ndefault   [  47% ] 108/200 VUs  2m24.8s/5m10.0s\n","time":"2023-06-22T01:48:31.091205315Z"}
{"type":"line","content":"\nrunning (2m25.9s), 108/200 VUs, 23892 complete and 0 interrupted iterations\ndefault   [  47% ] 108/200 VUs  2m25.8s/5m10.0s\n","time":"2023-06-22T01:48:32.091075422Z"}
{"type":"line","content":"\nrunning (2m26.9s), 109/200 VUs, 23966 complete and 0 interrupted iterations\ndefault   [  47% ] 109/200 VUs  2m26.8s/5m10.0s\n","time":"2023-06-22T01:48:33.091225587Z"}
{"type":"line","content":"\nrunning (2m27.9s), 109/200 VUs, 24107 complete and 0 interrupted iterations\ndefault   [  48% ] 109/200 VUs  2m27.8s/5m10.0s\n","time":"2023-06-22T01:48:34.090852321Z"}
{"type":"line","content":"\nrunning (2m28.9s), 110/200 VUs, 24294 complete and 0 interrupted iterations\ndefault   [  48% ] 110/200 VUs  2m28.8s/5m10.0s\n","time":"2023-06-22T01:48:35.091031058Z"}
{"type":"line","content":"\nrunning (2m29.9s), 110/200 VUs, 24379 complete and 0 interrupted iterations\ndefault   [  48% ] 110/200 VUs  2m29.8s/5m10.0s\n","time":"2023-06-22T01:48:36.091199985Z"}
{"type":"line","content":"\nrunning (2m30.9s), 111/200 VUs, 24566 complete and 0 interrupted iterations\ndefault   [  49% ] 111/200 VUs  2m30.8s/5m10.0s\n","time":"2023-06-22T01:48:37.091085475Z"}
{"type":"line","content":"\nrunning (2m31.9s), 112/200 VUs, 24812 complete and 0 interrupted iterations\ndefault   [  49% ] 112/200 VUs  2m31.8s/5m10.0s\n","time":"2023-06-22T01:48:38.090626243Z"}
{"type":"line","content":"\nrunning (2m32.9s), 112/200 VUs, 25216 complete and 0 interrupted iterations\ndefault   [  49% ] 112/200 VUs  2m32.8s/5m10.0s\n","time":"2023-06-22T01:48:39.091644317Z"}
{"type":"line","content":"\nrunning (2m33.9s), 113/200 VUs, 25493 complete and 0 interrupted iterations\ndefault   [  50% ] 113/200 VUs  2m33.8s/5m10.0s\n","time":"2023-06-22T01:48:40.12755389Z"}
{"type":"line","content":"\nrunning (2m34.9s), 113/200 VUs, 25743 complete and 0 interrupted iterations\ndefault   [  50% ] 113/200 VUs  2m34.8s/5m10.0s\n","time":"2023-06-22T01:48:41.090789405Z"}
{"type":"line","content":"\nrunning (2m35.9s), 114/200 VUs, 25930 complete and 0 interrupted iterations\ndefault   [  50% ] 114/200 VUs  2m35.8s/5m10.0s\n","time":"2023-06-22T01:48:42.095536078Z"}
{"type":"line","content":"\nrunning (2m36.9s), 114/200 VUs, 26112 complete and 0 interrupted iterations\ndefault   [  51% ] 114/200 VUs  2m36.8s/5m10.0s\n","time":"2023-06-22T01:48:43.091058495Z"}
{"type":"line","content":"\nrunning (2m37.9s), 115/200 VUs, 26441 complete and 0 interrupted iterations\ndefault   [  51% ] 115/200 VUs  2m37.8s/5m10.0s\n","time":"2023-06-22T01:48:44.091471567Z"}
{"type":"line","content":"\nrunning (2m38.9s), 115/200 VUs, 26765 complete and 0 interrupted iterations\ndefault   [  51% ] 115/200 VUs  2m38.8s/5m10.0s\n","time":"2023-06-22T01:48:45.090997457Z"}
{"type":"line","content":"\nrunning (2m39.9s), 116/200 VUs, 27006 complete and 0 interrupted iterations\ndefault   [  52% ] 116/200 VUs  2m39.8s/5m10.0s\n","time":"2023-06-22T01:48:46.090693929Z"}
{"type":"line","content":"\nrunning (2m40.9s), 117/200 VUs, 27378 complete and 0 interrupted iterations\ndefault   [  52% ] 117/200 VUs  2m40.8s/5m10.0s\n","time":"2023-06-22T01:48:47.091254513Z"}
{"type":"line","content":"\nrunning (2m41.9s), 117/200 VUs, 27768 complete and 0 interrupted iterations\ndefault   [  52% ] 117/200 VUs  2m41.8s/5m10.0s\n","time":"2023-06-22T01:48:48.090647613Z"}
{"type":"line","content":"\nrunning (2m42.9s), 118/200 VUs, 28178 complete and 0 interrupted iterations\ndefault   [  53% ] 118/200 VUs  2m42.8s/5m10.0s\n","time":"2023-06-22T01:48:49.091413981Z"}
{"type":"line","content":"\nrunning (2m43.9s), 118/200 VUs, 28549 complete and 0 interrupted iterations\ndefault   [  53% ] 118/200 VUs  2m43.8s/5m10.0s\n","time":"2023-06-22T01:48:50.092193374Z"}
{"type":"line","content":"\nrunning (2m44.9s), 119/200 VUs, 28969 complete and 0 interrupted iterations\ndefault   [  53% ] 119/200 VUs  2m44.8s/5m10.0s\n","time":"2023-06-22T01:48:51.090799985Z"}
{"type":"line","content":"\nrunning (2m45.9s), 119/200 VUs, 29285 complete and 0 interrupted iterations\ndefault   [  53% ] 119/200 VUs  2m45.8s/5m10.0s\n","time":"2023-06-22T01:48:52.09061565Z"}
{"type":"line","content":"\nrunning (2m46.9s), 120/200 VUs, 29349 complete and 0 interrupted iterations\ndefault   [  54% ] 120/200 VUs  2m46.8s/5m10.0s\n","time":"2023-06-22T01:48:53.0940556Z"}
{"type":"line","content":"\nrunning (2m47.9s), 120/200 VUs, 29371 complete and 0 interrupted iterations\ndefault   [  54% ] 120/200 VUs  2m47.8s/5m10.0s\n","time":"2023-06-22T01:48:54.092008677Z"}
{"type":"line","content":"\nrunning (2m48.9s), 121/200 VUs, 29385 complete and 0 interrupted iterations\ndefault   [  54% ] 121/200 VUs  2m48.8s/5m10.0s\n","time":"2023-06-22T01:48:55.091376489Z"}
{"type":"line","content":"\nrunning (2m49.9s), 122/200 VUs, 29394 complete and 0 interrupted iterations\ndefault   [  55% ] 122/200 VUs  2m49.8s/5m10.0s\n","time":"2023-06-22T01:48:56.094887756Z"}
{"type":"line","content":"\nrunning (2m50.9s), 122/200 VUs, 29466 complete and 0 interrupted iterations\ndefault   [  55% ] 122/200 VUs  2m50.8s/5m10.0s\n","time":"2023-06-22T01:48:57.091309467Z"}
{"type":"line","content":"\nrunning (2m51.9s), 123/200 VUs, 29519 complete and 0 interrupted iterations\ndefault   [  55% ] 123/200 VUs  2m51.8s/5m10.0s\n","time":"2023-06-22T01:48:58.091305621Z"}
{"type":"line","content":"\nrunning (2m52.9s), 123/200 VUs, 29525 complete and 0 interrupted iterations\ndefault   [  56% ] 123/200 VUs  2m52.8s/5m10.0s\n","time":"2023-06-22T01:48:59.091664111Z"}
{"type":"line","content":"\nrunning (2m53.9s), 124/200 VUs, 29593 complete and 0 interrupted iterations\ndefault   [  56% ] 124/200 VUs  2m53.8s/5m10.0s\n","time":"2023-06-22T01:49:00.09806038Z"}
{"type":"line","content":"\nrunning (2m54.9s), 124/200 VUs, 29676 complete and 0 interrupted iterations\ndefault   [  56% ] 124/200 VUs  2m54.8s/5m10.0s\n","time":"2023-06-22T01:49:01.093266256Z"}
{"type":"line","content":"\nrunning (2m55.9s), 125/200 VUs, 29728 complete and 0 interrupted iterations\ndefault   [  57% ] 125/200 VUs  2m55.8s/5m10.0s\n","time":"2023-06-22T01:49:02.091517146Z"}
{"type":"line","content":"\nrunning (2m56.9s), 125/200 VUs, 29804 complete and 0 interrupted iterations\ndefault   [  57% ] 125/200 VUs  2m56.8s/5m10.0s\n","time":"2023-06-22T01:49:03.099020806Z"}
{"type":"line","content":"\nrunning (2m57.9s), 126/200 VUs, 29875 complete and 0 interrupted iterations\ndefault   [  57% ] 126/200 VUs  2m57.8s/5m10.0s\n","time":"2023-06-22T01:49:04.091605863Z"}
{"type":"line","content":"\nrunning (2m58.9s), 127/200 VUs, 30024 complete and 0 interrupted iterations\ndefault   [  58% ] 127/200 VUs  2m58.8s/5m10.0s\n","time":"2023-06-22T01:49:05.091513462Z"}
{"type":"line","content":"\nrunning (2m59.9s), 127/200 VUs, 30174 complete and 0 interrupted iterations\ndefault   [  58% ] 127/200 VUs  2m59.8s/5m10.0s\n","time":"2023-06-22T01:49:06.091316884Z"}
{"type":"line","content":"\nrunning (3m00.9s), 128/200 VUs, 30310 complete and 0 interrupted iterations\ndefault   [  58% ] 128/200 VUs  3m00.8s/5m10.0s\n","time":"2023-06-22T01:49:07.093186175Z"}
{"type":"line","content":"\nrunning (3m01.9s), 128/200 VUs, 30409 complete and 0 interrupted iterations\ndefault   [  59% ] 128/200 VUs  3m01.8s/5m10.0s\n","time":"2023-06-22T01:49:08.090641343Z"}
{"type":"line","content":"\nrunning (3m02.9s), 129/200 VUs, 30534 complete and 0 interrupted iterations\ndefault   [  59% ] 129/200 VUs  3m02.8s/5m10.0s\n","time":"2023-06-22T01:49:09.091255817Z"}
{"type":"line","content":"\nrunning (3m04.0s), 129/200 VUs, 30612 complete and 0 interrupted iterations\ndefault   [  59% ] 129/200 VUs  3m03.9s/5m10.0s\n","time":"2023-06-22T01:49:10.287051362Z"}
{"type":"line","content":"\nrunning (3m04.9s), 130/200 VUs, 30791 complete and 0 interrupted iterations\ndefault   [  60% ] 130/200 VUs  3m04.8s/5m10.0s\n","time":"2023-06-22T01:49:11.091075523Z"}
{"type":"line","content":"\nrunning (3m05.9s), 130/200 VUs, 30907 complete and 0 interrupted iterations\ndefault   [  60% ] 130/200 VUs  3m05.8s/5m10.0s\n","time":"2023-06-22T01:49:12.091337283Z"}
{"type":"line","content":"\nrunning (3m06.9s), 131/200 VUs, 30911 complete and 0 interrupted iterations\ndefault   [  60% ] 131/200 VUs  3m06.8s/5m10.0s\n","time":"2023-06-22T01:49:13.090773314Z"}
{"type":"line","content":"\nrunning (3m07.9s), 132/200 VUs, 30911 complete and 0 interrupted iterations\ndefault   [  61% ] 132/200 VUs  3m07.8s/5m10.0s\n","time":"2023-06-22T01:49:14.091078679Z"}
{"type":"line","content":"\nrunning (3m08.9s), 132/200 VUs, 30911 complete and 0 interrupted iterations\ndefault   [  61% ] 132/200 VUs  3m08.8s/5m10.0s\n","time":"2023-06-22T01:49:15.09068183Z"}
{"type":"line","content":"\nrunning (3m09.9s), 133/200 VUs, 30911 complete and 0 interrupted iterations\ndefault   [  61% ] 133/200 VUs  3m09.8s/5m10.0s\n","time":"2023-06-22T01:49:16.090775264Z"}
{"type":"line","content":"\nrunning (3m10.9s), 133/200 VUs, 30912 complete and 0 interrupted iterations\ndefault   [  62% ] 133/200 VUs  3m10.8s/5m10.0s\n","time":"2023-06-22T01:49:17.090705105Z"}
{"type":"line","content":"\nrunning (3m11.9s), 134/200 VUs, 31015 complete and 0 interrupted iterations\ndefault   [  62% ] 134/200 VUs  3m11.8s/5m10.0s\n","time":"2023-06-22T01:49:18.091284376Z"}
{"type":"line","content":"\nrunning (3m12.9s), 134/200 VUs, 31015 complete and 0 interrupted iterations\ndefault   [  62% ] 134/200 VUs  3m12.8s/5m10.0s\n","time":"2023-06-22T01:49:19.092999345Z"}
{"type":"line","content":"\nrunning (3m13.9s), 135/200 VUs, 31081 complete and 0 interrupted iterations\ndefault   [  63% ] 135/200 VUs  3m13.8s/5m10.0s\n","time":"2023-06-22T01:49:20.094349834Z"}
{"type":"line","content":"\nrunning (3m14.9s), 135/200 VUs, 31271 complete and 0 interrupted iterations\ndefault   [  63% ] 135/200 VUs  3m14.8s/5m10.0s\n","time":"2023-06-22T01:49:21.090692003Z"}
{"type":"line","content":"\nrunning (3m15.9s), 136/200 VUs, 31346 complete and 0 interrupted iterations\ndefault   [  63% ] 136/200 VUs  3m15.8s/5m10.0s\n","time":"2023-06-22T01:49:22.090765512Z"}
{"type":"line","content":"\nrunning (3m16.9s), 137/200 VUs, 31383 complete and 0 interrupted iterations\ndefault   [  63% ] 137/200 VUs  3m16.8s/5m10.0s\n","time":"2023-06-22T01:49:23.091479516Z"}
{"type":"line","content":"\nrunning (3m17.9s), 137/200 VUs, 31417 complete and 0 interrupted iterations\ndefault   [  64% ] 137/200 VUs  3m17.8s/5m10.0s\n","time":"2023-06-22T01:49:24.090689102Z"}
{"type":"line","content":"\nrunning (3m18.9s), 138/200 VUs, 31583 complete and 0 interrupted iterations\ndefault   [  64% ] 138/200 VUs  3m18.8s/5m10.0s\n","time":"2023-06-22T01:49:25.09111657Z"}
{"type":"line","content":"\nrunning (3m19.9s), 138/200 VUs, 31750 complete and 0 interrupted iterations\ndefault   [  64% ] 138/200 VUs  3m19.8s/5m10.0s\n","time":"2023-06-22T01:49:26.091182769Z"}
{"type":"line","content":"\nrunning (3m20.9s), 139/200 VUs, 31930 complete and 0 interrupted iterations\ndefault   [  65% ] 139/200 VUs  3m20.8s/5m10.0s\n","time":"2023-06-22T01:49:27.091067699Z"}
{"type":"line","content":"\nrunning (3m21.9s), 139/200 VUs, 32123 complete and 0 interrupted iterations\ndefault   [  65% ] 139/200 VUs  3m21.8s/5m10.0s\n","time":"2023-06-22T01:49:28.101030651Z"}
{"type":"line","content":"\nrunning (3m22.9s), 140/200 VUs, 32307 complete and 0 interrupted iterations\ndefault   [  65% ] 140/200 VUs  3m22.8s/5m10.0s\n","time":"2023-06-22T01:49:29.099010125Z"}
{"type":"line","content":"\nrunning (3m23.9s), 140/200 VUs, 32483 complete and 0 interrupted iterations\ndefault   [  66% ] 140/200 VUs  3m23.8s/5m10.0s\n","time":"2023-06-22T01:49:30.09102589Z"}
{"type":"line","content":"\nrunning (3m24.9s), 141/200 VUs, 32582 complete and 0 interrupted iterations\ndefault   [  66% ] 141/200 VUs  3m24.8s/5m10.0s\n","time":"2023-06-22T01:49:31.090808342Z"}
{"type":"line","content":"\nrunning (3m25.9s), 142/200 VUs, 32720 complete and 0 interrupted iterations\ndefault   [  66% ] 142/200 VUs  3m25.8s/5m10.0s\n","time":"2023-06-22T01:49:32.09142128Z"}
{"type":"line","content":"\nrunning (3m26.9s), 142/200 VUs, 32726 complete and 0 interrupted iterations\ndefault   [  67% ] 142/200 VUs  3m26.8s/5m10.0s\n","time":"2023-06-22T01:49:33.090834818Z"}
{"type":"line","content":"\nrunning (3m27.9s), 143/200 VUs, 32728 complete and 0 interrupted iterations\ndefault   [  67% ] 143/200 VUs  3m27.8s/5m10.0s\n","time":"2023-06-22T01:49:34.091289043Z"}
{"type":"line","content":"\nrunning (3m28.9s), 143/200 VUs, 32728 complete and 0 interrupted iterations\ndefault   [  67% ] 143/200 VUs  3m28.8s/5m10.0s\n","time":"2023-06-22T01:49:35.091652872Z"}
{"type":"line","content":"\nrunning (3m29.9s), 144/200 VUs, 32732 complete and 0 interrupted iterations\ndefault   [  68% ] 144/200 VUs  3m29.8s/5m10.0s\n","time":"2023-06-22T01:49:36.091213245Z"}
{"type":"line","content":"\nrunning (3m30.9s), 144/200 VUs, 32769 complete and 0 interrupted iterations\ndefault   [  68% ] 144/200 VUs  3m30.8s/5m10.0s\n","time":"2023-06-22T01:49:37.091459082Z"}
{"type":"line","content":"\nrunning (3m31.9s), 145/200 VUs, 32774 complete and 0 interrupted iterations\ndefault   [  68% ] 145/200 VUs  3m31.8s/5m10.0s\n","time":"2023-06-22T01:49:38.091255479Z"}
{"type":"line","content":"\nrunning (3m32.9s), 145/200 VUs, 32780 complete and 0 interrupted iterations\ndefault   [  69% ] 145/200 VUs  3m32.8s/5m10.0s\n","time":"2023-06-22T01:49:39.091278667Z"}
{"type":"line","content":"\nrunning (3m33.9s), 146/200 VUs, 32829 complete and 0 interrupted iterations\ndefault   [  69% ] 146/200 VUs  3m33.8s/5m10.0s\n","time":"2023-06-22T01:49:40.2130762Z"}
{"type":"line","content":"\nrunning (3m34.9s), 147/200 VUs, 32941 complete and 0 interrupted iterations\ndefault   [  69% ] 147/200 VUs  3m34.8s/5m10.0s\n","time":"2023-06-22T01:49:41.091509019Z"}
{"type":"line","content":"\nrunning (3m35.9s), 147/200 VUs, 33039 complete and 0 interrupted iterations\ndefault   [  70% ] 147/200 VUs  3m35.8s/5m10.0s\n","time":"2023-06-22T01:49:42.091320535Z"}
{"type":"line","content":"\nrunning (3m36.9s), 148/200 VUs, 33041 complete and 0 interrupted iterations\ndefault   [  70% ] 148/200 VUs  3m36.8s/5m10.0s\n","time":"2023-06-22T01:49:43.091485083Z"}
{"type":"line","content":"\nrunning (3m37.9s), 148/200 VUs, 33133 complete and 0 interrupted iterations\ndefault   [  70% ] 148/200 VUs  3m37.8s/5m10.0s\n","time":"2023-06-22T01:49:44.090762303Z"}
{"type":"line","content":"\nrunning (3m38.9s), 149/200 VUs, 33286 complete and 0 interrupted iterations\ndefault   [  71% ] 149/200 VUs  3m38.8s/5m10.0s\n","time":"2023-06-22T01:49:45.090763822Z"}
{"type":"line","content":"\nrunning (3m39.9s), 149/200 VUs, 33450 complete and 0 interrupted iterations\ndefault   [  71% ] 149/200 VUs  3m39.8s/5m10.0s\n","time":"2023-06-22T01:49:46.091564918Z"}
{"type":"line","content":"\nrunning (3m40.9s), 150/200 VUs, 33580 complete and 0 interrupted iterations\ndefault   [  71% ] 150/200 VUs  3m40.8s/5m10.0s\n","time":"2023-06-22T01:49:47.091074444Z"}
{"type":"line","content":"\nrunning (3m41.9s), 150/200 VUs, 33775 complete and 0 interrupted iterations\ndefault   [  72% ] 150/200 VUs  3m41.8s/5m10.0s\n","time":"2023-06-22T01:49:48.091538267Z"}
{"type":"line","content":"\nrunning (3m42.9s), 151/200 VUs, 33960 complete and 0 interrupted iterations\ndefault   [  72% ] 151/200 VUs  3m42.8s/5m10.0s\n","time":"2023-06-22T01:49:49.091544982Z"}
{"type":"line","content":"\nrunning (3m43.9s), 152/200 VUs, 34162 complete and 0 interrupted iterations\ndefault   [  72% ] 152/200 VUs  3m43.8s/5m10.0s\n","time":"2023-06-22T01:49:50.091376199Z"}
{"type":"line","content":"\nrunning (3m44.9s), 152/200 VUs, 34361 complete and 0 interrupted iterations\ndefault   [  73% ] 152/200 VUs  3m44.8s/5m10.0s\n","time":"2023-06-22T01:49:51.090667313Z"}
{"type":"line","content":"\nrunning (3m45.9s), 153/200 VUs, 34403 complete and 0 interrupted iterations\ndefault   [  73% ] 153/200 VUs  3m45.8s/5m10.0s\n","time":"2023-06-22T01:49:52.091599763Z"}
{"type":"line","content":"\nrunning (3m46.9s), 153/200 VUs, 34428 complete and 0 interrupted iterations\ndefault   [  73% ] 153/200 VUs  3m46.8s/5m10.0s\n","time":"2023-06-22T01:49:53.091089073Z"}
{"type":"line","content":"\nrunning (3m47.9s), 154/200 VUs, 34481 complete and 0 interrupted iterations\ndefault   [  73% ] 154/200 VUs  3m47.8s/5m10.0s\n","time":"2023-06-22T01:49:54.090916572Z"}
{"type":"line","content":"\nrunning (3m48.9s), 154/200 VUs, 34482 complete and 0 interrupted iterations\ndefault   [  74% ] 154/200 VUs  3m48.8s/5m10.0s\n","time":"2023-06-22T01:49:55.0907159Z"}
{"type":"line","content":"\nrunning (3m49.9s), 155/200 VUs, 34482 complete and 0 interrupted iterations\ndefault   [  74% ] 155/200 VUs  3m49.8s/5m10.0s\n","time":"2023-06-22T01:49:56.091417314Z"}
{"type":"line","content":"\nrunning (3m50.9s), 155/200 VUs, 34482 complete and 0 interrupted iterations\ndefault   [  74% ] 155/200 VUs  3m50.8s/5m10.0s\n","time":"2023-06-22T01:49:57.090629715Z"}
{"type":"line","content":"\nrunning (3m51.9s), 156/200 VUs, 34547 complete and 0 interrupted iterations\ndefault   [  75% ] 156/200 VUs  3m51.8s/5m10.0s\n","time":"2023-06-22T01:49:58.091126357Z"}
{"type":"line","content":"\nrunning (3m52.9s), 157/200 VUs, 34561 complete and 0 interrupted iterations\ndefault   [  75% ] 157/200 VUs  3m52.8s/5m10.0s\n","time":"2023-06-22T01:49:59.091304734Z"}
{"type":"line","content":"\nrunning (3m53.9s), 157/200 VUs, 34562 complete and 0 interrupted iterations\ndefault   [  75% ] 157/200 VUs  3m53.8s/5m10.0s\n","time":"2023-06-22T01:50:00.092035394Z"}
{"type":"line","content":"\nrunning (3m54.9s), 158/200 VUs, 34636 complete and 0 interrupted iterations\ndefault   [  76% ] 158/200 VUs  3m54.8s/5m10.0s\n","time":"2023-06-22T01:50:01.091168072Z"}
{"type":"line","content":"\nrunning (3m55.9s), 158/200 VUs, 34717 complete and 0 interrupted iterations\ndefault   [  76% ] 158/200 VUs  3m55.8s/5m10.0s\n","time":"2023-06-22T01:50:02.090877737Z"}
{"type":"line","content":"\nrunning (3m56.9s), 159/200 VUs, 34769 complete and 0 interrupted iterations\ndefault   [  76% ] 159/200 VUs  3m56.8s/5m10.0s\n","time":"2023-06-22T01:50:03.091685507Z"}
{"type":"line","content":"\nrunning (3m57.9s), 159/200 VUs, 34897 complete and 0 interrupted iterations\ndefault   [  77% ] 159/200 VUs  3m57.8s/5m10.0s\n","time":"2023-06-22T01:50:04.090616404Z"}
{"type":"line","content":"\nrunning (3m58.9s), 160/200 VUs, 35013 complete and 0 interrupted iterations\ndefault   [  77% ] 160/200 VUs  3m58.8s/5m10.0s\n","time":"2023-06-22T01:50:05.090992495Z"}
{"type":"line","content":"\nrunning (3m59.9s), 160/200 VUs, 35168 complete and 0 interrupted iterations\ndefault   [  77% ] 160/200 VUs  3m59.8s/5m10.0s\n","time":"2023-06-22T01:50:06.090919808Z"}
{"type":"line","content":"\nrunning (4m00.9s), 161/200 VUs, 35330 complete and 0 interrupted iterations\ndefault   [  78% ] 161/200 VUs  4m00.8s/5m10.0s\n","time":"2023-06-22T01:50:07.094311262Z"}
{"type":"line","content":"\nrunning (4m01.9s), 162/200 VUs, 35472 complete and 0 interrupted iterations\ndefault   [  78% ] 162/200 VUs  4m01.8s/5m10.0s\n","time":"2023-06-22T01:50:08.090742661Z"}
{"type":"line","content":"\nrunning (4m02.9s), 162/200 VUs, 35623 complete and 0 interrupted iterations\ndefault   [  78% ] 162/200 VUs  4m02.8s/5m10.0s\n","time":"2023-06-22T01:50:09.090844964Z"}
{"type":"line","content":"\nrunning (4m03.9s), 163/200 VUs, 35757 complete and 0 interrupted iterations\ndefault   [  79% ] 163/200 VUs  4m03.8s/5m10.0s\n","time":"2023-06-22T01:50:10.177132404Z"}
{"type":"line","content":"\nrunning (4m04.9s), 163/200 VUs, 35827 complete and 0 interrupted iterations\ndefault   [  79% ] 163/200 VUs  4m04.8s/5m10.0s\n","time":"2023-06-22T01:50:11.091565799Z"}
{"type":"line","content":"\nrunning (4m05.9s), 164/200 VUs, 35913 complete and 0 interrupted iterations\ndefault   [  79% ] 164/200 VUs  4m05.8s/5m10.0s\n","time":"2023-06-22T01:50:12.091389905Z"}
{"type":"line","content":"\nrunning (4m06.9s), 164/200 VUs, 35927 complete and 0 interrupted iterations\ndefault   [  80% ] 164/200 VUs  4m06.8s/5m10.0s\n","time":"2023-06-22T01:50:13.090813888Z"}
{"type":"line","content":"\nrunning (4m07.9s), 165/200 VUs, 35931 complete and 0 interrupted iterations\ndefault   [  80% ] 165/200 VUs  4m07.8s/5m10.0s\n","time":"2023-06-22T01:50:14.091602059Z"}
{"type":"line","content":"\nrunning (4m08.9s), 165/200 VUs, 35931 complete and 0 interrupted iterations\ndefault   [  80% ] 165/200 VUs  4m08.8s/5m10.0s\n","time":"2023-06-22T01:50:15.091322407Z"}
{"type":"line","content":"\nrunning (4m09.9s), 166/200 VUs, 35943 complete and 0 interrupted iterations\ndefault   [  81% ] 166/200 VUs  4m09.8s/5m10.0s\n","time":"2023-06-22T01:50:16.090805841Z"}
{"type":"line","content":"\nrunning (4m10.9s), 167/200 VUs, 36023 complete and 0 interrupted iterations\ndefault   [  81% ] 167/200 VUs  4m10.8s/5m10.0s\n","time":"2023-06-22T01:50:17.091057265Z"}
{"type":"line","content":"\nrunning (4m11.9s), 167/200 VUs, 36370 complete and 0 interrupted iterations\ndefault   [  81% ] 167/200 VUs  4m11.8s/5m10.0s\n","time":"2023-06-22T01:50:18.090666848Z"}
{"type":"line","content":"\nrunning (4m12.9s), 168/200 VUs, 36840 complete and 0 interrupted iterations\ndefault   [  82% ] 168/200 VUs  4m12.8s/5m10.0s\n","time":"2023-06-22T01:50:19.091435914Z"}
{"type":"line","content":"\nrunning (4m14.0s), 168/200 VUs, 37201 complete and 0 interrupted iterations\ndefault   [  82% ] 168/200 VUs  4m13.9s/5m10.0s\n","time":"2023-06-22T01:50:20.202402872Z"}
{"type":"line","content":"\nrunning (4m14.9s), 169/200 VUs, 37679 complete and 0 interrupted iterations\ndefault   [  82% ] 169/200 VUs  4m14.8s/5m10.0s\n","time":"2023-06-22T01:50:21.090720286Z"}
{"type":"line","content":"\nrunning (4m15.9s), 169/200 VUs, 38002 complete and 0 interrupted iterations\ndefault   [  83% ] 169/200 VUs  4m15.8s/5m10.0s\n","time":"2023-06-22T01:50:22.092028866Z"}
{"type":"line","content":"\nrunning (4m16.9s), 170/200 VUs, 38043 complete and 0 interrupted iterations\ndefault   [  83% ] 170/200 VUs  4m16.8s/5m10.0s\n","time":"2023-06-22T01:50:23.091634664Z"}
{"type":"line","content":"\nrunning (4m17.9s), 170/200 VUs, 38170 complete and 0 interrupted iterations\ndefault   [  83% ] 170/200 VUs  4m17.8s/5m10.0s\n","time":"2023-06-22T01:50:24.100538663Z"}
{"type":"line","content":"\nrunning (4m18.9s), 171/200 VUs, 38337 complete and 0 interrupted iterations\ndefault   [  83% ] 171/200 VUs  4m18.8s/5m10.0s\n","time":"2023-06-22T01:50:25.090716233Z"}
{"type":"line","content":"\nrunning (4m19.9s), 172/200 VUs, 38532 complete and 0 interrupted iterations\ndefault   [  84% ] 172/200 VUs  4m19.8s/5m10.0s\n","time":"2023-06-22T01:50:26.090742429Z"}
{"type":"line","content":"\nrunning (4m20.9s), 172/200 VUs, 38647 complete and 0 interrupted iterations\ndefault   [  84% ] 172/200 VUs  4m20.8s/5m10.0s\n","time":"2023-06-22T01:50:27.09063629Z"}
{"type":"line","content":"\nrunning (4m21.9s), 173/200 VUs, 38817 complete and 0 interrupted iterations\ndefault   [  84% ] 173/200 VUs  4m21.8s/5m10.0s\n","time":"2023-06-22T01:50:28.090882199Z"}
{"type":"line","content":"\nrunning (4m22.9s), 173/200 VUs, 38977 complete and 0 interrupted iterations\ndefault   [  85% ] 173/200 VUs  4m22.8s/5m10.0s\n","time":"2023-06-22T01:50:29.091076587Z"}
{"type":"line","content":"\nrunning (4m23.9s), 174/200 VUs, 39155 complete and 0 interrupted iterations\ndefault   [  85% ] 174/200 VUs  4m23.8s/5m10.0s\n","time":"2023-06-22T01:50:30.094028702Z"}
{"type":"line","content":"\nrunning (4m24.9s), 174/200 VUs, 39337 complete and 0 interrupted iterations\ndefault   [  85% ] 174/200 VUs  4m24.8s/5m10.0s\n","time":"2023-06-22T01:50:31.090916121Z"}
{"type":"line","content":"\nrunning (4m25.9s), 175/200 VUs, 39464 complete and 0 interrupted iterations\ndefault   [  86% ] 175/200 VUs  4m25.8s/5m10.0s\n","time":"2023-06-22T01:50:32.091275973Z"}
{"type":"line","content":"\nrunning (4m26.9s), 175/200 VUs, 39494 complete and 0 interrupted iterations\ndefault   [  86% ] 175/200 VUs  4m26.8s/5m10.0s\n","time":"2023-06-22T01:50:33.091261812Z"}
{"type":"line","content":"\nrunning (4m27.9s), 176/200 VUs, 39494 complete and 0 interrupted iterations\ndefault   [  86% ] 176/200 VUs  4m27.8s/5m10.0s\n","time":"2023-06-22T01:50:34.09160445Z"}
{"type":"line","content":"\nrunning (4m28.9s), 177/200 VUs, 39496 complete and 0 interrupted iterations\ndefault   [  87% ] 177/200 VUs  4m28.8s/5m10.0s\n","time":"2023-06-22T01:50:35.090826933Z"}
{"type":"line","content":"\nrunning (4m29.9s), 177/200 VUs, 39765 complete and 0 interrupted iterations\ndefault   [  87% ] 177/200 VUs  4m29.8s/5m10.0s\n","time":"2023-06-22T01:50:36.0908368Z"}
{"type":"line","content":"\nrunning (4m30.9s), 178/200 VUs, 40265 complete and 0 interrupted iterations\ndefault   [  87% ] 178/200 VUs  4m30.8s/5m10.0s\n","time":"2023-06-22T01:50:37.094080179Z"}
{"type":"line","content":"\nrunning (4m31.9s), 178/200 VUs, 40642 complete and 0 interrupted iterations\ndefault   [  88% ] 178/200 VUs  4m31.8s/5m10.0s\n","time":"2023-06-22T01:50:38.098202307Z"}
{"type":"line","content":"\nrunning (4m32.9s), 179/200 VUs, 41153 complete and 0 interrupted iterations\ndefault   [  88% ] 179/200 VUs  4m32.8s/5m10.0s\n","time":"2023-06-22T01:50:39.090890019Z"}
{"type":"line","content":"\nrunning (4m34.0s), 179/200 VUs, 41572 complete and 0 interrupted iterations\ndefault   [  88% ] 179/200 VUs  4m33.9s/5m10.0s\n","time":"2023-06-22T01:50:40.221048017Z"}
{"type":"line","content":"\nrunning (4m34.9s), 180/200 VUs, 41920 complete and 0 interrupted iterations\ndefault   [  89% ] 180/200 VUs  4m34.8s/5m10.0s\n","time":"2023-06-22T01:50:41.091626832Z"}
{"type":"line","content":"\nrunning (4m35.9s), 180/200 VUs, 42228 complete and 0 interrupted iterations\ndefault   [  89% ] 180/200 VUs  4m35.8s/5m10.0s\n","time":"2023-06-22T01:50:42.091243088Z"}
{"type":"line","content":"\nrunning (4m36.9s), 181/200 VUs, 42299 complete and 0 interrupted iterations\ndefault   [  89% ] 181/200 VUs  4m36.8s/5m10.0s\n","time":"2023-06-22T01:50:43.091032798Z"}
{"type":"line","content":"\nrunning (4m37.9s), 182/200 VUs, 42501 complete and 0 interrupted iterations\ndefault   [  90% ] 182/200 VUs  4m37.8s/5m10.0s\n","time":"2023-06-22T01:50:44.090714167Z"}
{"type":"line","content":"\nrunning (4m38.9s), 182/200 VUs, 42739 complete and 0 interrupted iterations\ndefault   [  90% ] 182/200 VUs  4m38.8s/5m10.0s\n","time":"2023-06-22T01:50:45.090853455Z"}
{"type":"line","content":"\nrunning (4m39.9s), 183/200 VUs, 42902 complete and 0 interrupted iterations\ndefault   [  90% ] 183/200 VUs  4m39.8s/5m10.0s\n","time":"2023-06-22T01:50:46.09064568Z"}
{"type":"line","content":"\nrunning (4m40.9s), 183/200 VUs, 43215 complete and 0 interrupted iterations\ndefault   [  91% ] 183/200 VUs  4m40.8s/5m10.0s\n","time":"2023-06-22T01:50:47.104111136Z"}
{"type":"line","content":"\nrunning (4m41.9s), 184/200 VUs, 43635 complete and 0 interrupted iterations\ndefault   [  91% ] 184/200 VUs  4m41.8s/5m10.0s\n","time":"2023-06-22T01:50:48.090636882Z"}
{"type":"line","content":"\nrunning (4m42.9s), 184/200 VUs, 44093 complete and 0 interrupted iterations\ndefault   [  91% ] 184/200 VUs  4m42.8s/5m10.0s\n","time":"2023-06-22T01:50:49.091184386Z"}
{"type":"line","content":"\nrunning (4m43.9s), 185/200 VUs, 44459 complete and 0 interrupted iterations\ndefault   [  92% ] 185/200 VUs  4m43.8s/5m10.0s\n","time":"2023-06-22T01:50:50.091717338Z"}
{"type":"line","content":"\nrunning (4m44.9s), 185/200 VUs, 44807 complete and 0 interrupted iterations\ndefault   [  92% ] 185/200 VUs  4m44.8s/5m10.0s\n","time":"2023-06-22T01:50:51.093443061Z"}
{"type":"line","content":"\nrunning (4m45.9s), 186/200 VUs, 45028 complete and 0 interrupted iterations\ndefault   [  92% ] 186/200 VUs  4m45.8s/5m10.0s\n","time":"2023-06-22T01:50:52.091553832Z"}
{"type":"line","content":"\nrunning (4m46.9s), 187/200 VUs, 45081 complete and 0 interrupted iterations\ndefault   [  93% ] 187/200 VUs  4m46.8s/5m10.0s\n","time":"2023-06-22T01:50:53.094207135Z"}
{"type":"line","content":"\nrunning (4m47.9s), 187/200 VUs, 45084 complete and 0 interrupted iterations\ndefault   [  93% ] 187/200 VUs  4m47.8s/5m10.0s\n","time":"2023-06-22T01:50:54.09159474Z"}
{"type":"line","content":"\nrunning (4m48.9s), 188/200 VUs, 45317 complete and 0 interrupted iterations\ndefault   [  93% ] 188/200 VUs  4m48.8s/5m10.0s\n","time":"2023-06-22T01:50:55.090911621Z"}
{"type":"line","content":"\nrunning (4m49.9s), 188/200 VUs, 45436 complete and 0 interrupted iterations\ndefault   [  93% ] 188/200 VUs  4m49.8s/5m10.0s\n","time":"2023-06-22T01:50:56.09628967Z"}
{"type":"line","content":"\nrunning (4m50.9s), 189/200 VUs, 45496 complete and 0 interrupted iterations\ndefault   [  94% ] 189/200 VUs  4m50.8s/5m10.0s\n","time":"2023-06-22T01:50:57.091416863Z"}
{"type":"line","content":"\nrunning (4m51.9s), 189/200 VUs, 45924 complete and 0 interrupted iterations\ndefault   [  94% ] 189/200 VUs  4m51.8s/5m10.0s\n","time":"2023-06-22T01:50:58.090712911Z"}
{"type":"line","content":"\nrunning (4m52.9s), 190/200 VUs, 46467 complete and 0 interrupted iterations\ndefault   [  94% ] 190/200 VUs  4m52.8s/5m10.0s\n","time":"2023-06-22T01:50:59.09087502Z"}
{"type":"line","content":"\nrunning (4m53.9s), 190/200 VUs, 47012 complete and 0 interrupted iterations\ndefault   [  95% ] 190/200 VUs  4m53.8s/5m10.0s\n","time":"2023-06-22T01:51:00.123294115Z"}
{"type":"line","content":"\nrunning (4m54.9s), 191/200 VUs, 47434 complete and 0 interrupted iterations\ndefault   [  95% ] 191/200 VUs  4m54.8s/5m10.0s\n","time":"2023-06-22T01:51:01.092338374Z"}
{"type":"line","content":"\nrunning (4m55.9s), 192/200 VUs, 47673 complete and 0 interrupted iterations\ndefault   [  95% ] 192/200 VUs  4m55.8s/5m10.0s\n","time":"2023-06-22T01:51:02.091152825Z"}
{"type":"line","content":"\nrunning (4m56.9s), 192/200 VUs, 47748 complete and 0 interrupted iterations\ndefault   [  96% ] 192/200 VUs  4m56.8s/5m10.0s\n","time":"2023-06-22T01:51:03.091459986Z"}
{"type":"line","content":"\nrunning (4m57.9s), 193/200 VUs, 47930 complete and 0 interrupted iterations\ndefault   [  96% ] 193/200 VUs  4m57.8s/5m10.0s\n","time":"2023-06-22T01:51:04.090602636Z"}
{"type":"line","content":"\nrunning (4m58.9s), 193/200 VUs, 48115 complete and 0 interrupted iterations\ndefault   [  96% ] 193/200 VUs  4m58.8s/5m10.0s\n","time":"2023-06-22T01:51:05.090739583Z"}
{"type":"line","content":"\nrunning (4m59.9s), 194/200 VUs, 48285 complete and 0 interrupted iterations\ndefault   [  97% ] 194/200 VUs  4m59.8s/5m10.0s\n","time":"2023-06-22T01:51:06.091092121Z"}
{"type":"line","content":"\nrunning (5m00.9s), 194/200 VUs, 48650 complete and 0 interrupted iterations\ndefault   [  97% ] 194/200 VUs  5m00.8s/5m10.0s\n","time":"2023-06-22T01:51:07.09217152Z"}
{"type":"line","content":"\nrunning (5m01.9s), 195/200 VUs, 48969 complete and 0 interrupted iterations\ndefault   [  97% ] 195/200 VUs  5m01.8s/5m10.0s\n","time":"2023-06-22T01:51:08.090828055Z"}
{"type":"line","content":"\nrunning (5m02.9s), 195/200 VUs, 49441 complete and 0 interrupted iterations\ndefault   [  98% ] 195/200 VUs  5m02.8s/5m10.0s\n","time":"2023-06-22T01:51:09.09306888Z"}
{"type":"line","content":"\nrunning (5m03.9s), 196/200 VUs, 49951 complete and 0 interrupted iterations\ndefault   [  98% ] 196/200 VUs  5m03.8s/5m10.0s\n","time":"2023-06-22T01:51:10.090603396Z"}
{"type":"line","content":"\nrunning (5m04.9s), 197/200 VUs, 50503 complete and 0 interrupted iterations\ndefault   [  98% ] 197/200 VUs  5m04.8s/5m10.0s\n","time":"2023-06-22T01:51:11.090922156Z"}
{"type":"line","content":"\nrunning (5m05.9s), 197/200 VUs, 50814 complete and 0 interrupted iterations\ndefault   [  99% ] 197/200 VUs  5m05.8s/5m10.0s\n","time":"2023-06-22T01:51:12.091367164Z"}
{"type":"line","content":"\nrunning (5m06.9s), 198/200 VUs, 50860 complete and 0 interrupted iterations\ndefault   [  99% ] 198/200 VUs  5m06.8s/5m10.0s\n","time":"2023-06-22T01:51:13.091060511Z"}
{"type":"line","content":"\nrunning (5m07.9s), 198/200 VUs, 50866 complete and 0 interrupted iterations\ndefault   [  99% ] 198/200 VUs  5m07.8s/5m10.0s\n","time":"2023-06-22T01:51:14.090818385Z"}
{"type":"line","content":"\nrunning (5m08.9s), 199/200 VUs, 50871 complete and 0 interrupted iterations\ndefault   [ 100% ] 199/200 VUs  5m08.8s/5m10.0s\n","time":"2023-06-22T01:51:15.091222268Z"}
{"type":"line","content":"\nrunning (5m09.9s), 199/200 VUs, 51088 complete and 0 interrupted iterations\ndefault   [ 100% ] 199/200 VUs  5m09.8s/5m10.0s\n","time":"2023-06-22T01:51:16.09070834Z"}
```

Pode-se ver que, aparentemente, os testes aconteceram sem interrupções. Interrupções podem acontecer no caso em que a aplicação não consegue mais responder às requisições. Isso quer dizer, também, que a aplicação suportou bem a carga de requisições.
Deve-se notar, também, que o número de _virtual users (VUs)_ vai crescendo de 1 até atingir 200, durante 5 minutos.

Abaixo, podemos visualizar o relatório produzido pelo _Testkube_, apresentando alguns números sobre o resultado do teste de carga:
```
✗ is status 200
      ↳  99% — ✓ 51445 / ✗ 2

     █ setup

     checks.........................: 99.99% ✓ 51445      ✗ 2    
     data_received..................: 308 MB 992 kB/s
     data_sent......................: 75 MB  241 kB/s
     http_req_blocked...............: avg=12.48µs  min=887ns   med=2.8µs    max=73.77ms  p(90)=4.85µs  p(95)=6.38µs  
     http_req_connecting............: avg=5.78µs   min=0s      med=0s       max=73.68ms  p(90)=0s      p(95)=0s      
     http_req_duration..............: avg=638.88ms min=4.76ms  med=348.27ms max=9.61s    p(90)=1.31s   p(95)=2.03s   
       { expected_response:true }...: avg=638.91ms min=4.76ms  med=348.3ms  max=9.61s    p(90)=1.31s   p(95)=2.03s   
     http_req_failed................: 0.00%  ✓ 2          ✗ 51446
     http_req_receiving.............: avg=17.16ms  min=20.47µs med=72.58µs  max=5.29s    p(90)=5.79ms  p(95)=103.91ms
     http_req_sending...............: avg=47.98µs  min=6.35µs  med=17.77µs  max=314.92ms p(90)=38.05µs p(95)=50.63µs 
     http_req_tls_handshaking.......: avg=0s       min=0s      med=0s       max=0s       p(90)=0s      p(95)=0s      
     http_req_waiting...............: avg=621.67ms min=4.62ms  med=323.34ms max=9.61s    p(90)=1.29s   p(95)=2.01s   
     http_reqs......................: 51448  165.795076/s
     iteration_duration.............: avg=639.14ms min=4.92ms  med=348.51ms max=9.61s    p(90)=1.31s   p(95)=2.03s   
     iterations.....................: 51447  165.791853/s
     vus............................: 199    min=0        max=199
     vus_max........................: 200    min=200      max=200
```

Podemos verificar, por exemplo, que:
  - De um total de _51.447_ iterações, _51.445_ retornaram _200 OK_, enquanto _2_ falharam.
  - A média de duração de cada iteração, considerando _Kong API Gateway_ e _API_ de _backend_, ficou em _639,14ms_.

Agora, vamos explorar os gráficos do _Grafana_, começando pelos de _Request rate_:

![Grafana - Gráficos de Request rate](./images/grafana-graficos-request-rate.png)

- No gráfico de _Total requests per second (RPS)_, pode-se ver que houve um pico de _402_ requisições por segundo, diminuindo até chegar em _256_ _RPS_.
- No gráfico de _RPS per route/service (All)_, pode-se ver que o _kong-proxy_ obteve um pico de _210_ _RPS_, enquanto que a _API_ da aplicação chegou a um pico de _402_ _RPS_.
- No gráfico de _RPS per route/service by status code_, pode-se ver o _status code_ _502_ com _0,0333_ _RPS_ tanto para o _kong-proxy_ quanto para a _API_.

E, na seqüência, vamos examinar o gráfico de _Latencies_:

![Grafana - Gráficos de Latencies](./images/grafana-grafico-latencies.png)

Tendo, como referência, o _percentil 95_:

- A primeira faixa de gráficos, de cima para baixo, refere-se ao _Kong API Gateway_. Nela, podemos ver que a latência se manteve em torno de _212ms_/_request_.
- Já a terceira faixa de gráficos refere-se à _API_ do serviço de _backend_. Podemos ver que, no primeiro segundo, chegou a baixar de _963ms_ (~1 segundo/_request_) para _604ms_ (~0.5 segundo/_request_). Mas, no segundo seguinte, a latência volta a subir para _969ms_ (~1 segundo/_request_). 

Nesse sentido, verificamos que a _API_ do serviço de _backend_ vem afetando mais o desempenho da aplicação do que o _Kong API Gateway_, no que se refere à latência. 

#### CPU

Ao lidar com testes de carga de uma _API_ no cluster _Kubernetes_, à medida que o número de _PODs_ vai escalando (_upscaling_), o consumo total de _CPU_ das máquinas no _cluster_ pode ser excedido, fazendo com que muitos _PODs_ nem entrem em execução (i.e., ficam no _status_ de _Pending_, por falta de recurso de _CPU_). Neste caso, o que fazer?

A resposta pode estar relacionada com o tipo de aplicação que se está desenvolvendo.

1. Se for uma aplicação que utilize o mínimo de recursos e que não tenha o peso de um _framework_ embutido nela, por exemplo, uma aplicação muito simples desenvolvida em _Golang_. Dependendo do tipo de aplicação desenvolvida na linguagem _Go_, a imagem _Docker_ pode chegar a menos de _5MB_.

Neste caso, simplesmente diminuir a quantidade de _CPU_ a ser consumida em cada _POD_ pode resolver. Deve-se atentar, também, que, ao diminuir a quantidade de _CPU_, o desempenho da aplicação não pode ser impactado.

2. Já, se a aplicação precisar utilizar mais recursos e contiver um _framework_ embutido nela, como, por exemplo, uma aplicação _Spring Boot_, o tamanho da imagem _Docker_, dificilmente, poderá ser menor do que _70MB_. Neste caso, diminuir a quantidade de _CPU_ pode impactar, diretamente, no desempenho da aplicação, ou seja, ela pode ficar bastante lenta: se houver um pico de acessos, cada novo _POD_ que escalar pode demorar muito para subir. E, no final das contas, o total de _CPU_ consumido por todos os _PODs_ pode acabar excedendo, ainda, o total de _CPU_ disponível nas máquinas do _cluster_.

Neste caso, optar por trocar o tipo de máquina do _cluster_ para um tipo de máquina com mais recursos de _CPU_ e memória pode resolver. Por exemplo, no caso do _Google Cloud_, se estava sendo utilizado um tipo de máquina _n1-standard-1_, com 1 _CPU_ e _3.75GB_ de memória, pode-se trocar para um tipo _n1-standard-2_, que contém 2 _CPUs_ e _7.5GB_ de memória.


> Referências:

FULL CYCLE 3.0. API Gateway com Kong e Kubernetes. 2023. Disponível em: <https://plataforma.fullcycle.com.br>. Acesso em: 19 jun. 2023.

GOOGLE DEVELOPERS. Machine Types. 2023. Disponível em: <https://download.huihoo.com/google/gdgdevkit/DVD1/developers.google.com/compute/docs/machine-types.html>. Acesso em: 21 jun. 2023.

