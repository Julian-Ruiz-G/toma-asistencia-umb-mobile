# Toma Asistencia UMB

App en `apps/mobile`. API SAM/Lambda en `backend/`.

## GitHub (desde la raíz)

```powershell
cd C:\Users\USER\Desktop\Portafolio\proyecto_grado
git add .
git commit -m "tu mensaje"
git push
```

No hace falta `git init` otra vez: el repo ya está aquí. `git add .` no sube `node_modules`, `.aws-sam`, backups ni `.git-mobile-old`.

## Expo (desde `apps/mobile`)

```powershell
cd C:\Users\USER\Desktop\Portafolio\proyecto_grado\apps\mobile
npx expo start --go --tunnel --clear
npx eas-cli@latest update --branch preview --message "preview"
```

## Backend / Lambda (carpeta `backend`, ya no `test`)

```powershell
cd C:\Users\USER\Desktop\Portafolio\proyecto_grado\backend
sam build --use-container
```

Con rutas absolutas:

```powershell
sam build --use-container --template-file "C:\Users\USER\Desktop\Portafolio\proyecto_grado\backend\template.yaml" --base-dir "C:\Users\USER\Desktop\Portafolio\proyecto_grado\backend" --build-dir "C:\Users\USER\Desktop\Portafolio\proyecto_grado\backend\.aws-sam\build"
```
