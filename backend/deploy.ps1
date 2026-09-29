# Compila y despliega el backend.
#   powershell -ExecutionPolicy Bypass -File backend\deploy.ps1
#
# Importante: `sam deploy` debe usar el template del build (.aws-sam\build\template.yaml).
# Con backend\template.yaml se sube la carpeta src\ sin dependencias: la Lambda queda sin Pillow,
# no puede recortar los rostros de la foto de grupo y el reconocimiento falla.
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$buildDir = Join-Path $root '.aws-sam\build'
$builtTemplate = Join-Path $buildDir 'template.yaml'

sam build --use-container `
  --template-file (Join-Path $root 'template.yaml') `
  --base-dir $root `
  --build-dir $buildDir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Pillow debe ser la versión para Linux (.so); una de Windows (.pyd) tampoco carga en Lambda.
$pil = Join-Path $buildDir 'FaceApiFunction\PIL'
$linuxBinary = Get-ChildItem -Path $pil -Filter '_imaging*.so' -ErrorAction SilentlyContinue
if (-not $linuxBinary) {
  Write-Error 'El build no incluye Pillow para Linux. Revisa que Docker Desktop esté abierto y vuelve a ejecutar.'
  exit 1
}

sam deploy `
  --template-file $builtTemplate `
  --config-file (Join-Path $root 'samconfig.toml')
exit $LASTEXITCODE
