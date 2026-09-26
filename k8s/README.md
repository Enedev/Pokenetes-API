# AWS test (un solo ambiente) — cuenta ROOT

El profesor pidió usar la **cuenta root**. Un ambiente: `us-east-1`, cluster `pokenetes-test`.

No subas Access Keys ni `k8s/secret.yaml`.

## 1. Credenciales root (hazlo tú, no el repo)

1. Entra a la consola con el **correo root** (el de crear la cuenta), no con `pokenetesapi`.
2. Arriba a la derecha, el nombre de la cuenta → **Security credentials**.
3. **Access keys** → **Create access key** → confirma que entiendes el riesgo → Create.
4. Descarga el CSV.

PowerShell:

```powershell
aws configure
```

- Access Key ID y Secret del CSV
- Default region: `us-east-1`
- Default output format: `json`

Prueba:

```powershell
aws sts get-caller-identity
```

El `Arn` debe terminar en `:root`. Si sale `pokenetesapi`, volviste a entrar como IAM.

Cuando eso funcione, avisa y seguimos con ECR/SQS/EKS (o corre `.\scripts\aws-bootstrap-test.ps1`).

## 2. Billing (root)

Con root, Billing ya debería abrirse. Crea un budget de $5–$10.

## 3. eksctl (además de kubectl, que ya está)

https://github.com/eksctl-io/eksctl/releases — zip Windows, extrae `eksctl.exe` y ponlo en el PATH.

```powershell
eksctl version
```

## 4. Cluster (solo después del sts)

```powershell
eksctl create cluster -f k8s/eks-cluster.yaml
aws eks update-kubeconfig --name pokenetes-test --region us-east-1
kubectl get nodes
```

Tiene que haber 2 nodos `Ready`.

## 5. AWS Secrets Manager (el cofre del diagrama)

En EKS los pods leen `pokenetes/test` al arrancar. Localmente sigues usando `.env.test` (no pongas `AWS_SECRETS_MANAGER_SECRET_ID`).

```powershell
node scripts\put-secrets-manager-test.mjs
```

Eso crea o actualiza el secreto en la consola: **Secrets Manager → pokenetes/test**.

Los nodos del cluster necesitan permiso de lectura (una vez):

```powershell
$role = aws eks describe-nodegroup --cluster-name pokenetes-test --nodegroup-name ng-test --query nodegroup.nodeRole --output text --region us-east-1
$roleName = ($role -split "/")[-1]
aws iam put-role-policy --role-name $roleName --policy-name pokenetes-secrets-manager --policy-document file://k8s/iam-secrets-manager-policy.json
```

Luego manifiestos (ya no hace falta `k8s/secret.yaml` en EKS):

```powershell
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
```

Las imágenes de `api.yaml` y `orchestrator.yaml` ya apuntan a ECR. Luego:

```powershell
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/orchestrator.yaml
kubectl get deploy,svc,hpa -n pokenetes
```

Pruebas:

```powershell
kubectl get pods -n pokenetes
# 2 pods API + 2 orquestador Running

curl http://<EXTERNAL-IP-API>/health
curl http://<EXTERNAL-IP-ORQ>/health
```

Entrada del orquestador según el diagrama (API Gateway, TLS, rate limit, trace-id):

```powershell
.\scripts\aws-api-gateway-test.ps1
```
