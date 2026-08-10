---
title: 'From Push to Production with GitHub Actions, Docker and GHCR'
description: 'Building a React app into a Docker image, publishing it to GitHub Container Registry and deploying to Azure Container Apps.'
pubDate: 'Aug 10 2026'
heroImage: '/img/GitHubActionsDocker/hero.png'
---

<h2 align="center">
    From Push to Production: GitHub Actions, Docker, GHCR and Azure Container Apps
</h2>

Hello friends! In my last post about [SQL Database DevOps](/sql-database-devops/) we automated a database deployment with GitHub Actions. Today I want to do the same thing but for a frontend application, and this time the artifact is not a `.dacpac`, it is a **Docker image**.

The idea is simple: I push code, GitHub Actions builds and tests it, packages it into a container image, pushes that image to **GitHub Container Registry (GHCR)** and then tells **Azure Container Apps** to run it. No manual steps, no `docker push` from my laptop, and no passwords stored anywhere. 🧑🏻‍💻

You can check all the code in my GitHub repository: [react-github-actions-demo](https://github.com/LuisiitoDev/react-github-actions-demo), and the result is live here: [Rick and Morty Multiverse Explorer](https://rickandmortyreactdemo.wittymushroom-27985f5c.westus2.azurecontainerapps.io/).

The app itself is a small React + TypeScript + Vite application that consumes the public [Rick and Morty API](https://rickandmortyapi.com/) and lets you browse characters, locations and episodes. It is intentionally simple, because the interesting part today is everything that happens **after** you press push.

![Characters grid showing Rick, Morty, Summer, Beth and Jerry with their status pills](/img/GitHubActionsDocker/characters.png)

Every card opens a detail panel with the data coming from the API:

![Character detail modal for Rick Sanchez showing status, species, gender, origin, location and episode count](/img/GitHubActionsDocker/character-modal.png)

And the episodes view groups every transmission by season:

![Episodes view listing season 1 episodes with air dates and detected character counts](/img/GitHubActionsDocker/episodes.png)

The app even renders its own pipeline on the landing page, so you can see the whole trip at a glance:

![Deployment pipeline: React build, GitHub Actions, Docker image, GHCR and Azure Container Apps](/img/GitHubActionsDocker/pipeline.png)

---

## The big picture

Before jumping into YAML, let's understand the pieces:

| Piece | Responsibility |
| --- | --- |
| **Dockerfile** | Turns the React source into a tiny nginx image that serves static files. |
| **GHCR** | Stores every image we build, tagged by commit SHA. |
| **GitHub Actions (CI)** | Lint, test and build on every Pull Request. |
| **GitHub Actions (CD)** | Build the image, push it to GHCR, and update the Container App. |
| **Azure Container Apps** | Runs the container, gives us HTTPS ingress and scale-to-zero. |
| **Bicep** | Creates the infrastructure so nothing is clicked in the portal. |

Something important here: the **image is the artifact**. CI validates the source code, but what we deploy is an immutable image tagged with the commit SHA, so we always know exactly what is running in production.

---

## Multi-stage Dockerfile

A very common mistake when containerizing a React app is shipping the whole `node_modules` folder to production. We do not need Node at runtime! Once Vite generates the `dist` folder, everything we need is plain HTML, CSS and JS, so a small nginx image is more than enough.

For this reason, we use a multi-stage build:

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

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

Let's see what is happening:

1. **`base` stage**: we copy only `package*.json` first and run `npm ci`. This is not random, it is done for **layer caching**. If your source code changes but your dependencies do not, Docker reuses the cached `npm ci` layer and the build is much faster.
2. **`build` stage**: runs `npm run build` and produces the `dist` folder.
3. **Final stage**: starts from `nginx:1.27-alpine` and copies **only** the `dist` folder with `COPY --from=build`. The Node toolchain never reaches the final image.

We also have a `.dockerignore` file, which is as important as the Dockerfile itself:

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

Without it, your local `node_modules` gets sent to the Docker daemon as build context, making the build slow for no reason.

### Do not forget the nginx config

React apps are Single Page Applications, so if the user refreshes on `/characters`, nginx will look for a file with that name, will not find it, and will return a 404. To avoid this, we need a `try_files` fallback to `index.html`:

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

Notice that nginx listens on **8080** and not on 80. This is on purpose: Container Apps does not require root, and using a non privileged port is a good practice. Just remember that the port here must match the `targetPort` of your ingress, otherwise your app will build perfectly and still answer nothing.

---

## Continuous Integration

The CI workflow is the gatekeeper. It runs on every Pull Request against `main` and it does not build any image, it only validates that the code is healthy:

```yaml
name: CI

run-name: CI Rick And Morty

on:
  pull_request:
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

Nothing fancy: lint, test with Vitest, and a build to be sure TypeScript is happy. The `cache: 'npm'` option makes `setup-node` restore the npm cache between runs, which saves a good amount of time.

---

## Continuous Deployment

Now the fun part. The CD workflow is triggered by `workflow_run`, so it only starts when CI finished, and only continues if CI finished **successfully**:

```yaml
name: CD

run-name: CD Rick And Morty

on:
  workflow_run:
    workflows: ["CI"]
    types:
      - completed

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

Those three permissions are exactly what we need and nothing more:

* `id-token: write` → required to request an OIDC token for Azure.
* `contents: read` → to checkout the code.
* `packages: write` → to push the image to GHCR.

### Job 1: publish the image to GHCR

```yaml
jobs:
  publish:
    name: Publish Image
    runs-on: ubuntu-latest
    if: github.event.workflow_run.conclusion == 'success'
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

There are a few details here that I really like:

**1. We checkout the exact commit that CI validated.** When a workflow is triggered by `workflow_run`, by default it checks out the default branch, which could already have new commits. Using `ref: ${{ github.event.workflow_run.head_sha }}` guarantees that the image contains exactly the code that passed CI.

**2. GHCR authentication is free.** We do not need to create a Personal Access Token, the automatic `secrets.GITHUB_TOKEN` is enough as long as we declared `packages: write`.

**3. `${IMAGE_NAME,,}` lowercases the string.** This is a Bash parameter expansion, and it is necessary because container registries only accept lowercase repository names, but my GitHub user is `LuisiitoDev` with capital letters. Without this, the push fails with a very confusing error.

**4. Two tags, two purposes.** The `:latest` tag is comfortable for humans, and the commit SHA tag is the one we actually deploy, because it is immutable and traceable.

**5. `org.opencontainers.image.source` label.** This is what links the package in GHCR back to the repository, so the package page shows the README and inherits the repo visibility.

**6. GitHub Actions cache for Docker layers.** With `cache-from: type=gha` and `cache-to: type=gha,mode=max` the layers are stored in the Actions cache, so the `npm ci` layer is reused between runs.

### Job 2: deploy to Azure Container Apps

```yaml
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: publish
    steps:
      - name: Log in to Azure using OIDC
        uses: azure/login@v2
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

Same OIDC login that we used in the SQL post: **no secrets with passwords**, GitHub exchanges a short-lived token with Entra ID and that is it. Notice that the Azure identifiers live in `vars` (repository variables) and not in `secrets`, because a subscription id or a resource group name is not really a secret.

The deployment itself is a single `az containerapp update --image ...`. Container Apps creates a new revision with the new image, waits until it is healthy, and moves the traffic. If the new revision never becomes healthy, the old one keeps serving, which is a nice safety net for free.

The last step writes the production URL into `$GITHUB_STEP_SUMMARY`, so at the end of every deployment you get a clickable link in the workflow summary page instead of hunting for the FQDN in the portal. Small detail, but very comfortable.

---

## The infrastructure with Bicep

I did not want to create the Container App by clicking in the portal, so the managed environment and the app itself live in `infra/main.bicep`:

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

Some things worth mentioning:

* `targetPort: 8080` matches the `listen 8080` of our nginx config. As I said before, this pair must always agree.
* `minReplicas: 0` means **scale to zero**. If nobody visits the site, we pay nothing for compute. The price is a cold start on the first request after an idle period, which for a demo is a perfect trade.
* The `http-concurrency` rule scales out when a replica is handling more than 50 concurrent requests, up to 3 replicas.

The infrastructure workflow is separated from the application one, and it only runs when something under `infra/**` changes. It also validates the template before deploying it:

```yaml
on:
    pull_request:
        branches:
            - main
        paths:
            - 'infra/**'
    workflow_dispatch:
```

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

You will notice the placeholder image `containerapps-helloworld`. This is because the infrastructure and the application have different lifecycles: the Bicep template only needs to guarantee that the Container App **exists**, and the CD workflow is the one responsible for pointing it to the real image. If we hardcoded our image in Bicep, every infrastructure deployment would roll production back to whatever tag is written in the template.

---

## A couple of things I learned

* **Make the image public in GHCR, or give Container Apps credentials.** By default a package published from a repository is private. If the Container App cannot pull the image, the revision fails to provision and the error in the portal is not very explicit. Either flip the package visibility to public, or configure a registry secret on the Container App.
* **`workflow_run` only triggers from the default branch.** The workflow file must already be in `main` for the CD to fire, so testing it from a feature branch will not work as you expect.
* **Ports are the number one cause of a "successful deployment" that answers nothing.** nginx port, `EXPOSE`, and `targetPort` should tell the same story.

---

## Wrap up

With this setup, the full trip from a Pull Request to production is completely automated: CI validates the code, Docker packages it into a small nginx image, GHCR stores it tagged by commit SHA, and Azure Container Apps runs it behind HTTPS with scale to zero. And the only credentials involved are short-lived OIDC tokens.

The best part is that this pattern is not React specific at all. Change the Dockerfile and the exact same pipeline deploys an API, a worker, or whatever you can put inside a container.

I hope that it could be helpfull, Happy coding!!! 🧑🏻‍💻 😁

### References:
* [Working with the Container registry (GHCR)](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
* [Azure Container Apps documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
* [Configure OpenID Connect in Azure](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-azure)
* [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
