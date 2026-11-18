# Honeytoken

Secreto señuelo `pokenetes/backup-admin-credentials`, con usuario y clave sintéticos. El rol de la API puede leerlo para que parezca real. La alarma `gd1-honeytoken-touched` cuenta cada `GetSecretValue` cuyo identificador contiene `backup-admin`.

`src/config/env.ts` solo lee las claves que la API usa. `BACKUP_ADMIN_SECRET_ID` puede vivir en el secreto `pokenetes/terraform` sin cambiar el arranque.

Fuentes consultadas el 18 de noviembre de 2026: ficha D3-DUC, Decoy User Credential, https://d3fend.mitre.org/technique/d3f:DecoyUserCredential/ y la guía "AWS API Keys Canarytoken", https://docs.canarytokens.org/guide/aws-keys-token.html. El issue de Thumper que se había citado devuelve 404.

Riesgo residual del rol `pokenetes-github-deployer`: tiene `AdministratorAccess` para que los pipelines sigan pudiendo aplicar Terraform. No es una identidad de mínimo privilegio.

El 17 de noviembre de 2026 se borraron de GitHub Actions los secretos `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`. `terraform-pipeline` y `canary-pipeline` asumen `pokenetes-github-deployer` por OIDC. `chaos-gate` no usa llaves de AWS. Las llaves de acceso root de la cuenta no se borraron. `get-account-summary` sigue en `AccountAccessKeysPresent` = 1. Ese es un riesgo residual.
