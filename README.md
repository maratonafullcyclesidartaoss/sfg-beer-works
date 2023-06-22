# SFG Beer Works - RESTful Brewery Service - CI / CD & Monitoramento em Produção

O projeto é baseado em uma _API REST_ para fins didáticos desenvolvida por [John Thompson](http://www.linkedin.com/in/springguru). [Aqui](https://sfg-beer-works.github.io/brewery-api/#tag/Beer-Service) pode-se acessar a documentação.

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
  - Logs
    - EFK
      - Elastisearch
      - Fluentd
      - Kibana

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
<p style="text-align: center;">Fonte: FULL CYCLE 3.0. API Gateway com Kong e Kubernetes.</p>

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

- Rodar o _Scan_ do _SonarCloud_
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
- status_code_metrics
- latency_metrics
- upstream_health_metrics
- bandwidth_metrics

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

14. Acessar via _port-forward_:
```
$ kubectl port-forward svc/argocd-server -n argocd 8083:443
```

![Aplicação brewery ArgoCD](./images/aplicacao-brewery-argocd.png)

Neste momento, o repositório do _GitHub_ torna-se a fonte da verdade (_source of truth_): qualquer alteração no repositório é sincronizada automaticamente com o _cluster Kubernetes_.

#### Testes de carga

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
```

![Teste de carga rodando](./images/teste-carga-rodando.png)


Referências:
FULL CYCLE 3.0. API Gateway com Kong e Kubernetes. 2023. Disponível em: <https://plataforma.fullcycle.com.br>. Acesso em: 19 jun. 2023.
