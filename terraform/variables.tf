variable "aws_region" {
  description = "Region de los recursos."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Prefijo de nombres."
  type        = string
  default     = "pokenetes"
}

variable "stable_image" {
  description = "Imagen del track stable fijada por digest: <repo>@sha256:<digest>. Vacia solo para crear el ECR."
  type        = string
  default     = ""

  validation {
    condition     = var.stable_image == "" || can(regex("@sha256:[a-f0-9]{64}$", var.stable_image))
    error_message = "stable_image debe fijarse por digest (<repo>@sha256:<64 hex>)."
  }
}

variable "canary_image" {
  description = "Imagen del track canary fijada por digest: <repo>@sha256:<digest>. Vacia solo para crear el ECR."
  type        = string
  default     = ""

  validation {
    condition     = var.canary_image == "" || can(regex("@sha256:[a-f0-9]{64}$", var.canary_image))
    error_message = "canary_image debe fijarse por digest (<repo>@sha256:<64 hex>)."
  }
}

variable "instance_type" {
  description = "Mismo tipo para ambos tracks, asi la comparacion contra el baseline es justa."
  type        = string
  default     = "t3.micro"
}

variable "sticky_sessions" {
  description = "Fija cada cliente a un target group durante sticky_seconds."
  type        = bool
  default     = false
}

variable "sticky_seconds" {
  type    = number
  default = 300
}

variable "fault_token" {
  description = "Si se define, el canary solo acepta inyeccion de fallas con la cabecera x-fault-token."
  type        = string
  default     = ""
  sensitive   = true
}

variable "auto_rollback" {
  description = "Si las alarmas del canary disparan la Lambda que devuelve el 100% a stable."
  type        = bool
  default     = true
}
