param(
  [string]$ProjectName = "corporate-signage",
  [switch]$SkipDiskCheck
)

$ErrorActionPreference = "Stop"
$env:COMPOSE_PARALLEL_LIMIT = "1"

function Invoke-DockerCompose {
  param([string[]]$Arguments)

  & docker compose -p $ProjectName @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "O comando 'docker compose $($Arguments -join ' ')' falhou com codigo $LASTEXITCODE."
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker nao foi encontrado. Instale ou abra o Docker Desktop antes de continuar."
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "O Docker Desktop nao esta em execucao. Abra-o e aguarde aparecer 'Engine running'."
}

if (-not $SkipDiskCheck) {
  $systemDrive = (Get-CimInstance Win32_OperatingSystem).SystemDrive.TrimEnd(':')
  $drive = Get-PSDrive -Name $systemDrive
  $freeGb = [math]::Round($drive.Free / 1GB, 1)
  Write-Host "Espaco livre em $($systemDrive): $freeGb GB"
  if ($freeGb -lt 15) {
    throw "Ha menos de 15 GB livres. Libere espaco antes de reconstruir para evitar npm EIO."
  }
}

Write-Host "Construindo API, Dashboard e Player de forma sequencial..."
Invoke-DockerCompose -Arguments @("build", "api")
Invoke-DockerCompose -Arguments @("build", "dashboard")
Invoke-DockerCompose -Arguments @("build", "player")
Invoke-DockerCompose -Arguments @("up", "-d")
Invoke-DockerCompose -Arguments @("ps")

Write-Host "Atualizacao concluida. Dashboard: http://localhost:8080"
