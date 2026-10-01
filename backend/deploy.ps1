# Compila y despliega el backend.
#   powershell -ExecutionPolicy Bypass -File backend\deploy.ps1
#
# Pillow viene en la capa PillowLayerArn (template.yaml), así que la Lambda lo tiene aunque se
# despliegue con backend\template.yaml. Este script despliega el template del build, que es lo habitual.
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$buildDir = Join-Path $root '.aws-sam\build'
$builtTemplate = Join-Path $buildDir 'template.yaml'

sam build --use-container `
  --template-file (Join-Path $root 'template.yaml') `
  --base-dir $root `
  --build-dir $buildDir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# El template compilado debe seguir usando la capa de Pillow.
if (-not (Select-String -Path $builtTemplate -Pattern 'PillowLayerArn' -Quiet)) {
  Write-Error 'El template no conecta la capa de Pillow (PillowLayerArn). Sin ella el reconocimiento de la foto de grupo falla.'
  exit 1
}

sam deploy `
  --template-file $builtTemplate `
  --config-file (Join-Path $root 'samconfig.toml')
exit $LASTEXITCODE
