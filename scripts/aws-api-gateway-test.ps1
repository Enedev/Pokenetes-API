param(
  [string]$Region = "us-east-1",
  [string]$ApiName = "pokenetes-orchestrator"
)

$ErrorActionPreference = "Stop"

$elb = kubectl get svc pokenetes-orchestrator -n pokenetes -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"
if (-not $elb) {
  throw "The orchestrator LoadBalancer has no hostname yet."
}

$integrationUri = "http://$elb/{proxy}"
Write-Host "Backend: $integrationUri"

$apiId = aws apigatewayv2 get-apis --region $Region --query "Items[?Name=='$ApiName'].ApiId | [0]" --output text
if (-not $apiId -or $apiId -eq "None") {
  $apiId = aws apigatewayv2 create-api `
    --name $ApiName `
    --protocol-type HTTP `
    --description "TLS, rate limit and x-trace-id in front of the Pokenetes orchestrator" `
    --cors-configuration "AllowOrigins=*,AllowMethods=GET,POST,OPTIONS,AllowHeaders=content-type,x-trace-id" `
    --region $Region `
    --query ApiId `
    --output text
  Write-Host "Created API $apiId"
} else {
  Write-Host "API already exists: $apiId"
  aws apigatewayv2 update-api `
    --api-id $apiId `
    --cors-configuration "AllowOrigins=*,AllowMethods=GET,POST,OPTIONS,AllowHeaders=content-type,x-trace-id" `
    --region $Region | Out-Null
}

$integrationId = aws apigatewayv2 get-integrations --api-id $apiId --region $Region --query "Items[0].IntegrationId" --output text
if (-not $integrationId -or $integrationId -eq "None") {
  $integrationId = aws apigatewayv2 create-integration `
    --api-id $apiId `
    --integration-type HTTP_PROXY `
    --integration-method ANY `
    --integration-uri $integrationUri `
    --payload-format-version "1.0" `
    --region $Region `
    --query IntegrationId `
    --output text
  Write-Host "Created integration $integrationId"
} else {
  aws apigatewayv2 update-integration `
    --api-id $apiId `
    --integration-id $integrationId `
    --integration-type HTTP_PROXY `
    --integration-method ANY `
    --integration-uri $integrationUri `
    --payload-format-version "1.0" `
    --region $Region | Out-Null
  Write-Host "Updated integration $integrationId"
}

$routeKey = "ANY /{proxy+}"
$routeId = aws apigatewayv2 get-routes --api-id $apiId --region $Region --query "Items[?RouteKey=='$routeKey'].RouteId | [0]" --output text
if (-not $routeId -or $routeId -eq "None") {
  aws apigatewayv2 create-route `
    --api-id $apiId `
    --route-key $routeKey `
    --target "integrations/$integrationId" `
    --region $Region | Out-Null
  Write-Host "Created route $routeKey"
}

$stage = aws apigatewayv2 get-stages --api-id $apiId --region $Region --query "Items[?StageName=='test'].StageName | [0]" --output text
if (-not $stage -or $stage -eq "None") {
  aws apigatewayv2 create-stage `
    --api-id $apiId `
    --stage-name test `
    --auto-deploy `
    --region $Region | Out-Null
}

aws apigatewayv2 update-stage `
  --api-id $apiId `
  --stage-name test `
  --default-route-settings "ThrottlingRateLimit=10,ThrottlingBurstLimit=20" `
  --region $Region | Out-Null

$endpoint = aws apigatewayv2 get-api --api-id $apiId --region $Region --query ApiEndpoint --output text
Write-Host ""
Write-Host "API Gateway (HTTPS): $endpoint/test"
Write-Host "Rate limit: 10 requests/second, burst 20"
Write-Host "Send header x-trace-id. The orchestrator returns it on POST /api/v2/flujo."
