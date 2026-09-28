param(
  [string]$Region = "us-east-1",
  [string]$Cluster = "pokenetes-test"
)

$ErrorActionPreference = "Stop"

$role = aws eks describe-nodegroup --cluster-name $Cluster --nodegroup-name ng-test --query nodegroup.nodeRole --output text --region $Region
if (-not $role -or $role -eq "None") {
  throw "Node group ng-test is not ready yet."
}
$roleName = ($role -split "/")[-1]
aws iam attach-role-policy --role-name $roleName --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy | Out-Null

$yaml = Join-Path $env:TEMP "cw.yaml"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluent-bit-quickstart.yaml" -OutFile $yaml
$raw = Get-Content $yaml -Raw
$raw = $raw.Replace("{{cluster_name}}", $Cluster).Replace("{{region_name}}", $Region)
$raw = $raw.Replace("{{http_server_toggle}}", "`"On`"")
$raw = $raw.Replace("{{http_server_port}}", "`"2020`"")
$raw = $raw.Replace("{{read_from_head}}", "`"Off`"")
$raw = $raw.Replace("{{read_from_tail}}", "`"On`"")
Set-Content $yaml $raw -Encoding utf8
kubectl apply -f $yaml

kubectl -n amazon-cloudwatch delete configmap fluent-bit-cluster-info --ignore-not-found
kubectl -n amazon-cloudwatch create configmap fluent-bit-cluster-info `
  --from-literal=cluster.name=$Cluster `
  --from-literal=logs.region=$Region `
  --from-literal=http.server=On `
  --from-literal=http.port=2020 `
  --from-literal=read.head=Off `
  --from-literal=read.tail=On
kubectl -n amazon-cloudwatch rollout status daemonset/fluent-bit --timeout=180s
Write-Host "Container Insights is shipping logs to /aws/containerinsights/$Cluster/application"
