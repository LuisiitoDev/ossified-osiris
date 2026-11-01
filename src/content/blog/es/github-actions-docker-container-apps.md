---
title: 'React + Docker + GitHub Actions'
description: 'Cómo compilar React en una imagen Docker, publicarla en GitHub Container Registry y desplegarla en Azure Container Apps.'
pubDate: '2026-08-10'
updatedDate: '2026-10-31'
heroImage: '/img/GitHubActionsDocker/hero.png'
tags: ['github-actions', 'docker', 'ghcr', 'azure', 'react']
lang: 'es'
---

> **Actualización de seguridad y corrección (octubre de 2026):** Un despliegue basado en `workflow_run` tiene acceso privilegiado y debe rechazar ejecuciones de CI provenientes de pull requests o repositorios no confiables. Los ejemplos actuales compilan tanto en PR como en pushes a `main`, pero solo publican después de un `push` confiable y exitoso. El puerto de Docker ahora coincide con nginx (8080). Una **etiqueta con el SHA del commit mejora la trazabilidad, pero no garantiza inmutabilidad**; usá el **digest** de la imagen cuando necesitás identificarla sin ambigüedad. Consultá las [recomendaciones de seguridad de GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use) y las [protecciones para OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers).

<h2 align="center">
    Del push a producción con GitHub Actions, Docker y GHCR
</h2>

¡Hola! En mi artículo anterior sobre [DevOps para bases de datos SQL](/es/sql-database-devops/) desplegamos una base de datos mediante GitHub Actions y el artefacto del pipeline era un archivo `.dacpac`. Hoy haremos algo parecido con una aplicación frontend, pero esta vez el artefacto será una **imagen Docker**.

La idea es sencilla: hago un push; GitHub Actions compila y prueba el código, empaqueta la aplicación en una imagen, la publica en **GitHub Container Registry** y, finalmente, le indica a **Azure Container Apps** que la ejecute. Sin pasos manuales, sin hacer `docker push` desde mi computadora y sin almacenar contraseñas. 🧑🏻‍💻

Encontrás el código completo en [react-github-actions-demo](https://github.com/LuisiitoDev/react-github-actions-demo) y podés ver la aplicación aquí: [Rick and Morty Multiverse Explorer](https://rickandmortyreactdemo.wittymushroom-27985f5c.westus2.azurecontainerapps.io/).

## La aplicación

Para este ejemplo creé una aplicación pequeña con React, TypeScript y Vite que consume la [API pública de Rick y Morty](https://rickandmortyapi.com/) (sí, otra vez esta serie; ¡me encanta! 😁). Permite explorar personajes, ubicaciones y episodios:

![Tarjetas de Rick, Morty, Summer, Beth y Jerry con su estado](/img/GitHubActionsDocker/characters.png)

Cada tarjeta abre un panel con los datos del personaje:

![Detalle del personaje Rick Sánchez](/img/GitHubActionsDocker/character-modal.png)

En la sección de episodios podemos verlos agrupados por temporada:

![Episodios de la primera temporada](/img/GitHubActionsDocker/episodes.png)

La aplicación es deliberadamente sencilla porque lo importante aquí es todo lo que sucede **después** de hacer push. De hecho, la página inicial muestra el pipeline que vamos a construir:

![Pipeline de despliegue: React, GitHub Actions, Docker, GHCR y Azure Container Apps](/img/GitHubActionsDocker/pipeline.png)

Antes de empezar, recordemos que en este pipeline **la imagen es el artefacto**. CI valida el código, pero lo que desplegamos es una imagen etiquetada con el SHA del commit, lo que permite rastrear la revisión de código prevista. La etiqueta puede modificarse; para garantizar la identidad del artefacto, utilizá su digest.

---

## Veamos el Dockerfile

Un error frecuente al contenerizar una aplicación React es enviar toda la carpeta `node_modules` a producción. ¡No necesitamos Node en tiempo de ejecución! Una vez que Vite genera `dist`, solo quedan archivos HTML, CSS y JavaScript, que nginx puede servir desde una imagen pequeña.

Por eso utilizamos una compilación de múltiples etapas (*multi-stage build*):

```dockerfile
FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json /app/
RUN npm ci

COPY . .

FROM base AS build
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

En la primera etapa copiamos solamente los archivos `package*.json` y ejecutamos `npm ci`. Esto tiene un propósito: aprovechar el **caché de capas** de Docker. Si cambia nuestro código pero no las dependencias, Docker puede reutilizar la capa almacenada de `npm ci`, acelerando la compilación.

La segunda etapa ejecuta `npm run build` y genera `dist`. En la última partimos de `nginx:1.27-alpine` y copiamos **únicamente** esa carpeta mediante `COPY --from=build`. Las herramientas de Node no llegan a la imagen final.

También tenemos un archivo `.dockerignore`, que considero tan importante como el Dockerfile:

```
node_modules
dist
coverage
.git
.github
.vscode
.env
.env.*
README.md
```

Sin ese archivo, `node_modules` de nuestro equipo podría enviarse al daemon de Docker como contexto de compilación, haciendo el proceso más lento sin necesidad.

### No olvidés la configuración de nginx

Las aplicaciones React suelen ser SPA (*Single Page Applications*). Si el usuario actualiza el navegador estando en `/characters`, nginx intenta encontrar un archivo con ese nombre y devuelve 404. Para resolverlo, configuramos `try_files` para regresar a `index.html`:

```nginx
server {
    listen 8080;
    server_name _;

    absolute_redirect off;  # prevents nginx from rewriting redirect URLs with its internal port

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /health {
        access_log off;
        return 200 "Healthy\n";
        add_header Content-Type text/plain;
    }
}
```

Observá que nginx escucha en el puerto **8080**, no en el 80. Esto es intencional: Container Apps no necesita privilegios de root, y utilizar un puerto no privilegiado es una buena práctica. El puerto debe coincidir con `targetPort` en el ingreso de Container Apps; de lo contrario, la aplicación podría compilar perfectamente sin responder a las solicitudes.

---

## Integración continua

El workflow CI es nuestro filtro de calidad. Se ejecuta en cada pull request hacia `main` **y en los pushes confiables a `main`**. No compila una imagen: verifica que el código esté en buenas condiciones. CD solo debe desplegar después de una ejecución exitosa de CI originada por un push:

```yaml
name: CI

run-name: CI Rick And Morty

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Linter
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Build app
        run: npm run build
```

Aquí usamos un linter, pruebas con Vitest y una compilación para comprobar TypeScript. Una recomendación pequeña: no olvidés `cache: 'npm'`, ya que permite a `setup-node` recuperar el caché de npm entre ejecuciones y ahorrar tiempo.

---

## Despliegue continuo

¡Ahora viene la parte interesante! CD se activa mediante `workflow_run`, pero **un resultado exitoso por sí solo no autoriza un despliegue a producción**. Debemos verificar que CI proviene de un `push` confiable en la rama `main` del repositorio:

```yaml
name: CD

run-name: CD Rick And Morty

on:
  workflow_run:
    workflows: ["CI"]
    types:
      - completed
    branches: [main]

permissions:
  id-token: write
  contents: read
  packages: write

env:
  IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/react-github-actions-demo
  AZURE_CLIENT_ID: ${{ vars.AZURE_CLIENT_ID }}
  AZURE_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}
  AZURE_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}
  AZURE_RESOURCE_GROUP: ${{ vars.AZURE_RESOURCE_GROUP }}
  AZURE_CONTAINER_APP_NAME: ${{ vars.APP_NAME }}
```

Esos tres permisos son exactamente los que necesitamos: `id-token: write` para solicitar un token OIDC de Azure, `contents: read` para obtener el código y `packages: write` para publicar la imagen en GHCR.

### Publicación de la imagen en GHCR

```yaml
jobs:
  publish:
    name: Publish Image
    runs-on: ubuntu-latest
    if: >-
      ${{
        github.event.workflow_run.conclusion == 'success' &&
        github.event.workflow_run.event == 'push' &&
        github.event.workflow_run.head_branch == 'main' &&
        github.event.workflow_run.head_repository.full_name == github.repository
      }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha }}

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set image reference
        id: image
        run: |
          echo "value=${IMAGE_NAME,,}:${{ github.event.workflow_run.head_sha }}" >> "$GITHUB_OUTPUT"
          echo "latest=${IMAGE_NAME,,}:latest" >> "$GITHUB_OUTPUT"

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ${{ steps.image.outputs.value }}
            ${{ steps.image.outputs.latest }}
          labels: |
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
            org.opencontainers.image.revision=${{ github.event.workflow_run.head_sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

Veamos algunos detalles del trabajo que considero importantes.

El primero es el checkout. Cuando un workflow se activa por `workflow_run`, de forma predeterminada obtiene la rama principal, que podría tener commits nuevos. Al usar `workflow_run.head_sha` seleccionamos exactamente el commit probado en CI. **Esto debe hacerse únicamente después de limitar el trabajo privilegiado a ejecuciones confiables**; nunca debemos ejecutar código arbitrario de un PR con credenciales de producción.

El segundo detalle es la autenticación con GHCR. No necesitamos crear un token de acceso personal: `secrets.GITHUB_TOKEN` es suficiente si declaramos `packages: write` en los permisos.

El tercero me tomó un tiempo comprenderlo: la expresión de Bash `IMAGE_NAME` seguida de `,,` convierte el nombre a minúsculas. Esto es necesario porque los registros de contenedores solo aceptan nombres de repositorio en minúsculas, mientras que mi usuario de GitHub contiene mayúsculas. Sin esta conversión, la publicación falla con un error poco claro.

También publicamos dos etiquetas. `:latest` es cómoda para las personas, pero para desplegar utilizamos la etiqueta con el SHA del commit, porque ayuda a rastrear qué revisión produjo la imagen. **Una etiqueta sigue siendo mutable**, incluso si su nombre corresponde al SHA. Cuando necesitás fijar exactamente la imagen publicada, desplegá con un digest OCI, por ejemplo `ghcr.io/owner/image@sha256:...`.

La etiqueta `org.opencontainers.image.source` vincula el paquete de GHCR con nuestro repositorio, lo que permite mostrar información del proyecto y heredar su configuración de visibilidad.

Finalmente, con `cache-from: type=gha` y `cache-to: type=gha,mode=max`, las capas de Docker se conservan en el caché de GitHub Actions, permitiendo reutilizar la capa de `npm ci` entre ejecuciones.

### Despliegue en Azure Container Apps

```yaml
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: publish
    steps:
      - name: Log in to Azure using OIDC
        uses: azure/login@v3
        with:
          client-id: ${{ env.AZURE_CLIENT_ID }}
          tenant-id: ${{ env.AZURE_TENANT_ID }}
          subscription-id: ${{ env.AZURE_SUBSCRIPTION_ID }}

      - name: Deploy Image
        run: |
          OWNER=$(echo "${{ github.repository_owner }}" | tr '[:upper:]' '[:lower:]')
          az containerapp update \
              --name "${{ env.AZURE_CONTAINER_APP_NAME }}" \
              --resource-group "${{ env.AZURE_RESOURCE_GROUP }}" \
              --image "ghcr.io/${OWNER}/react-github-actions-demo:${{ github.event.workflow_run.head_sha }}"

      - name: Get application URL
        id: appurl
        run: |
          FQDN=$(az containerapp show \
              --name "${{ env.AZURE_CONTAINER_APP_NAME }}" \
              --resource-group "${{ env.AZURE_RESOURCE_GROUP }}" \
              --query properties.configuration.ingress.fqdn -o tsv)
          echo "url=https://$FQDN" >> "$GITHUB_OUTPUT"

      - name: Publish application URL
        run: |
          echo "Production URL: ${{ steps.appurl.outputs.url }}" >> "$GITHUB_STEP_SUMMARY"
```

Aquí utilizamos el mismo inicio de sesión OIDC del artículo de SQL. De nuevo, **sin contraseñas almacenadas**: GitHub intercambia un token de corta duración con Entra ID. Los identificadores de Azure están en `vars` (variables del repositorio), no en `secrets`, ya que el identificador de una suscripción o el nombre de un grupo de recursos no son secretos por sí mismos.

El despliegue utiliza un comando: `az containerapp update --image ...`. Container Apps crea una nueva revisión, comprueba que esté lista y gestiona el tráfico según la configuración del servicio. Si la revisión nueva no se encuentra saludable, la anterior puede seguir atendiendo solicitudes, siempre que el enrutamiento y la configuración de revisiones se hayan preparado correctamente.

El último paso escribe la URL de producción en `GITHUB_STEP_SUMMARY`, así que al terminar cada despliegue obtenemos un enlace directo desde el resumen del workflow.

---

## Infraestructura con Bicep

No quería crear la Container App manualmente desde el portal. Por eso, el entorno administrado y la aplicación se definen en `infra/main.bicep`:

```bicep
param location string = resourceGroup().location
param appName string
param containerImage string
param containerPort int = 8080

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${appName}-env'
  location: location
  properties: {}
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: containerPort
        transport: 'auto'
      }
    }
    template: {
      containers: [
        {
          name: appName
          image: containerImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}
```

Tres aspectos merecen atención. `targetPort: 8080` coincide con `listen 8080` de nginx; ambos valores deben estar alineados. `minReplicas: 0` permite **escalar a cero** cuando no hay solicitudes, lo que puede reducir los costos de cómputo, a cambio de un arranque en frío después de un período de inactividad. Para una demostración como esta, esa compensación es aceptable.

La regla `http-concurrency` permite aumentar las réplicas cuando una instancia supera 50 solicitudes simultáneas, hasta un máximo de tres réplicas.

El workflow de infraestructura está separado del workflow de la aplicación y se ejecuta únicamente cuando cambia algo dentro de `infra/**`:

```yaml
on:
    pull_request:
        branches:
            - main
        paths:
            - 'infra/**'
    workflow_dispatch:
```

También valida la plantilla antes de desplegar, evitando muchos errores de configuración:

```yaml
            - name: Validate Bicep
              run: >-
                az deployment group validate
                --resource-group "${{ env.AZURE_RESOURCE_GROUP }}"
                --template-file infra/main.bicep
                --parameters
                location="${{ env.AZURE_LOCATION }}"
                appName="${{ env.APP_NAME }}"
                containerImage="mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
                --output none
```

Quizá notaste la imagen de ejemplo `containerapps-helloworld`. Esto ocurre porque la infraestructura y la aplicación tienen ciclos de vida diferentes: Bicep debe garantizar que la Container App **exista**, mientras el workflow CD decide qué imagen real debe ejecutar. Si fijáramos la imagen en la plantilla Bicep, volver a desplegar infraestructura podría cambiar inesperadamente la imagen de producción a la etiqueta definida allí.

---

## Lecciones aprendidas

La primera vez que configuré este pipeline, todo aparecía en verde, pero la aplicación no respondía. Estas fueron algunas de las dificultades que más tiempo me tomaron:

* De forma predeterminada, los paquetes publicados pueden ser **privados**. Si Container Apps no puede descargar la imagen, la revisión falla al aprovisionarse, y el error del portal no siempre es explícito. Podés publicar el paquete o configurar credenciales de registro en la Container App.
* El evento `workflow_run` solo se activa si el archivo del workflow se encuentra en la rama predeterminada. Para que CD funcione, su archivo debe estar ya en `main`; probarlo únicamente desde una rama de funcionalidad no produce el mismo comportamiento.
* Y los puertos... ¡siempre los puertos! El puerto de nginx, `EXPOSE` y `targetPort` deben coincidir.

## Conclusión

Con esta configuración, los pull requests ejecutan CI sin acceso a producción. Cuando los cambios aprobados llegan a `main`, un push confiable activa CI; una ejecución exitosa puede publicar y desplegar la imagen en Azure Container Apps.

GHCR conserva una etiqueta basada en el SHA del commit para trazabilidad. En producción, conviene utilizar un digest cuando se requiere una identidad inmutable de la imagen. Configurá entornos protegidos y permisos de federación OIDC de Azure con el mínimo alcance necesario.

Lo mejor es que este patrón no sirve únicamente para React: cambiando el Dockerfile, el mismo pipeline puede desplegar una API, un worker o cualquier aplicación contenida en una imagen.

¡Espero que te resulte útil! ¡Feliz programación! 🧑🏻‍💻 😁

### Referencias
* [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
* [Documentación de Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/)
* [Configuración de OpenID Connect en Azure](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-azure)
* [Compilaciones multi-stage de Docker](https://docs.docker.com/build/building/multi-stage/)
