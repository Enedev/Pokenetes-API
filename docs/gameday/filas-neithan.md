# Filas de Neithan para el cierre (Exp. 1)

Consulta de catálogos: 17 de noviembre de 2026. ATT&CK Enterprise v20.1 (vigente; v20.1 publicada el 5 de noviembre de 2026). D3FEND en d3fend.mitre.org el mismo día.

## ATT&CK verificado

| ID | Nombre exacto | Versión de la técnica | URL |
|---|---|---|---|
| T1552.005 | Unsecured Credentials: Cloud Instance Metadata API | 1.4 | https://attack.mitre.org/techniques/T1552/005/ |
| T1078.004 | Valid Accounts: Cloud Accounts | 2.0 | https://attack.mitre.org/techniques/T1078/004/ |
| T1555.006 | Credentials from Password Stores: Cloud Secrets Management Stores | 1.0 | https://attack.mitre.org/techniques/T1555/006/ |
| T1580 | Cloud Infrastructure Discovery | 1.3 | https://attack.mitre.org/techniques/T1580/ |

Los cuatro existen en la v20.1. En la R1 se detectaron T1078.004 y T1555.006. T1552.005 y T1580 se emularon y no tienen alarma propia: cobertura 2/4.

## D3FEND verificado

| ID | Nombre exacto | Qué hay en AWS |
|---|---|---|
| D3-DUC | Decoy User Credential | Secreto `pokenetes/backup-admin-credentials` y alarma `gd1-honeytoken-touched`. |
| D3-AZET | Authorization Event Thresholding | Filtro de `GetSecretValue` del rol fuera del VPC endpoint; alarma `gd1-role-secret-outside-vpce` con suma ≥ 1 en 60 s. |
| D3-UGLPA | User Geolocation Logon Pattern Analysis | No implementada. No hay análisis de geolocalización de inicios de sesión. |
| D3-CRO | Credential Rotation | Parcial: OIDC y credenciales temporales del rol. No hay rotación de la llave root (`AccountAccessKeysPresent` = 1). |

## Inventario de controles

| Capa | Control | Nube | Dueño | Señal | D3FEND |
|---|---|---|---|---|---|
| Identidad | Rol `pokenetes-api-instance`. `GetSecretValue` solo si `aws:SourceVpce` es `vpce-03c96dbd9816f6a62`; Deny si el endpoint falta o es otro. | AWS us-east-1 | Neithan | `AccessDenied` desde fuera. Alarma `gd1-role-secret-outside-vpce`. | D3-AZET |
| Identidad | Rol `pokenetes-github-deployer` por OIDC, solo `refs/heads/main` y `refs/heads/dev` del repo `Enedev/Pokenetes-API`. | AWS | Neithan | `AssumeRoleWithWebIdentity`. Las llaves estáticas de Actions se borraron. | D3-CRO |
| Datos | Secreto de la app `pokenetes/terraform`. | AWS Secrets Manager | Neithan | `GetSecretValue` de las instancias trae `vpcEndpointId` en CloudTrail. | D3-AZET |
| Datos | Señuelo `pokenetes/backup-admin-credentials`, usuario y clave sintéticos. | AWS Secrets Manager | Neithan | Alarma `gd1-honeytoken-touched`. | D3-DUC |
| Detección | Trail `pokenetes-gameday` a `/pokenetes/cloudtrail`, retención 30 días. SNS `pokenetes-security`. | AWS | Neithan | Las dos alarmas `gd1` y el correo. | D3-AZET |
| Red | Endpoint de interfaz de Secrets Manager, DNS privado, 443 solo desde el security group de la API. | AWS | Neithan | Las lecturas de la app salen por `vpce-03c96dbd9816f6a62`. | — |
| Carga de trabajo | Imagen fijada por digest. `HEALTHCHECK` en la imagen y health del ALB. `docker run` no pone memoria ni CPU, y el Dockerfile no declara `USER`: el contenedor corre como root. | AWS EC2 | Neithan | Target healthy y `/health` 200. Esta capa no tiene experimento. | — |

## Trazabilidad del Exp. 1

| Control | R0 | R1 | ISO 27001:2022 A | NIST 800-53 r5 | NIST 800-207 | ATT&CK | D3FEND |
|---|---|---|---|---|---|---|---|
| Credencial del rol leída en el IMDS y usada fuera de AWS | Secreto leído. Sin alarma. Hipótesis refutada. t0 2026-11-17T19:01:39Z. | Lectura denegada a los 17 s. `gd1-role-secret-outside-vpce` a los 155 s. Hipótesis cumplida. t0 2026-11-18T01:21:54Z. | A.5.15, A.5.16, A.8.2 | AC-3, AC-6, IA-9 | Mínimo privilegio; verificación continua | T1552.005 emulada, no detectada. T1078.004 detectada. | D3-AZET |
| Lectura de Secrets Manager | `GetSecretValue` permitida. | `GetSecretValue` denegada en la pasada medida. | A.5.17, A.8.5 | IA-5, AC-6 | Mínimo privilegio | T1555.006 detectada | D3-AZET |
| Enumeración iam, s3 y ec2 | Denegada en las tres. | Denegada en las tres. | A.8.2 | AC-6 | Mínimo privilegio | T1580 emulada, no detectada | — |
| Señuelo `backup-admin` | No existía. | La pasada con la guarda apagada lo leyó y `gd1-honeytoken-touched` pasó a ALARM a las 2026-11-18T01:20:03Z. | A.5.17 | SC-26 | — | Apoya la detección de T1555.006 | D3-DUC |

## Tendencia: honeytoken

Fuentes consultadas el 18 de noviembre de 2026: ficha D3-DUC, Decoy User Credential, https://d3fend.mitre.org/technique/d3f:DecoyUserCredential/ y la guía "AWS API Keys Canarytoken", https://docs.canarytokens.org/guide/aws-keys-token.html. El issue de Thumper que se había citado devuelve 404.

Qué se implementó: secreto sintético `pokenetes/backup-admin-credentials`, permiso de lectura en el rol de la API para que parezca real, y alarma `gd1-honeytoken-touched` sobre `GetSecretValue` cuyo identificador contiene `backup-admin`.

Evidencia: en la R1 la alarma pasó de OK a ALARM a las 2026-11-18T01:20:03Z, con el dato 1.0 en el minuto 01:19Z. CloudTrail registró `GetSecretValue` de `pokenetes/backup-admin-credentials` a las 01:19:18Z.

Riesgo residual: el rol `pokenetes-github-deployer` conserva `AdministratorAccess`. La llave de acceso root de la cuenta no se borró (`AccountAccessKeysPresent` = 1).
