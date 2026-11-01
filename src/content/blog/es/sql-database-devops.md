---
title: 'DevOps para bases de datos SQL: CI/CD con DACPAC'
description: 'Compilá un proyecto SQL Server en un DACPAC y desplegá cambios de esquema a Azure SQL mediante GitHub Actions, MSBuild y OIDC.'
pubDate: '2026-06-03'
updatedDate: '2026-10-31'
heroImage: '/img/SQLDataBaseDevOps/hero.png'
tags: ['sql-server', 'azure', 'devops', 'github-actions', 'ci-cd']
lang: 'es'
---

> **Actualización de seguridad (octubre de 2026):** El ejemplo original de despliegue con `workflow_run` necesitaba un límite de confianza. Una compilación exitosa de un pull request **no debe** autorizar automáticamente el despliegue de su DACPAC mediante un workflow privilegiado. El ejemplo de CD actualizado solo despliega compilaciones exitosas de eventos **push** en la rama confiable `master` del repositorio. Configurá reglas de protección de GitHub Environments, restringí la confianza federada de Azure OIDC y verificá la procedencia de los artefactos antes de desplegar. Consultá las [recomendaciones de seguridad de GitHub](https://docs.github.com/en/actions/reference/security/secure-use).

<h2 align="center">
    SQL Server DevOps: CI/CD con DACPAC y GitHub Actions
</h2>

¡Hola! Hoy quiero compartir algo muy interesante en lo que he estado trabajando. Si desarrollás software, probablemente sabés lo complejo que puede resultar administrar actualizaciones en una base de datos. Muchos proyectos utilizan archivos de migración, pero en determinadas situaciones conviene administrar el esquema mediante un enfoque declarativo basado en estado.

En este artículo veremos cómo configurar un proyecto de base de datos SQL Server (`.sqlproj`), compilarlo como un archivo `.dacpac` y desplegarlo automáticamente en Azure SQL usando GitHub Actions. 🧑🏻‍💻

Encontrás el código completo en mi repositorio: [SQLDataBaseDevOps](https://github.com/LuisiitoDev/SQLDataBaseDevOps).

---

## ¿Qué es un SQL Project y un DACPAC?

Primero debemos comprender qué es un proyecto SQL. Un SQL Project permite definir el esquema de una base de datos (tablas, vistas y procedimientos almacenados) mediante scripts declarativos. En lugar de escribir migraciones con `ALTER TABLE`, definimos el estado deseado con `CREATE TABLE` y dejamos que las herramientas determinen los cambios necesarios.

Al compilar el proyecto, obtenemos un archivo **DACPAC** (*Data-tier Application Package*) que contiene la representación completa del esquema de la base de datos.

---

## Estructura del proyecto SQL

Veamos cómo está organizado el proyecto. Tenemos un archivo `MyShopping.sqlproj` que indica al compilador cómo construir el esquema. En este ejemplo, el destino es Azure SQL Database:

```xml
<?xml version="1.0" encoding="utf-8"?>
<Project DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003" ToolsVersion="4.0">
  <PropertyGroup>
    <!-- Target Database Schema Provider -->
    <DSP>Microsoft.Data.Tools.Schema.Sql.SqlAzureV12DatabaseSchemaProvider</DSP>
    <OutputType>Database</OutputType>
    <Name>MyShopping</Name>
    <TargetFrameworkVersion>v4.7.2</TargetFrameworkVersion>
  </PropertyGroup>
  <ItemGroup>
    <Folder Include="Properties" />
    <Folder Include="Tables" />
  </ItemGroup>
  <ItemGroup>
    <Build Include="Tables\Song.sql" />
  </ItemGroup>
</Project>
```

Como se observa, configuramos el proveedor `SqlAzureV12DatabaseSchemaProvider` para Azure SQL e incluimos nuestras tablas dentro de la carpeta `Tables`.

En `Tables/Song.sql` definimos una tabla mediante una instrucción estándar `CREATE TABLE`:

```sql
CREATE TABLE [dbo].[Song]
(
    [Id] INT NOT NULL PRIMARY KEY,
    [Name] VARCHAR(500) NOT NULL,
    [Author] VARCHAR(500) NOT NULL
)
```

Si en el futuro queremos agregar columnas, podemos modificar directamente este archivo sin crear un script de migración nuevo.

---

## Integración continua: compilar el DACPAC

Para compilar automáticamente el proyecto de base de datos, creamos un workflow de GitHub Actions llamado `ci-database.yml`.

Como `.sqlproj` utiliza el formato clásico de proyectos .NET, necesitamos MSBuild. Por eso ejecutamos la compilación en un runner de Windows:

```yaml
name: Database CI - Build DACPAC

on:
  push:
    branches:
      - master
  pull_request:

jobs:
  build:
    name: Build SQL Project
    runs-on: windows-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup MSBuild
        uses: microsoft/setup-msbuild@v1

      - name: Build SQL Project
        run: |
          msbuild ./MyShopping/MyShopping.sqlproj `
            /p:Configuration=Release

      - name: Upload DACPAC Artifact
        uses: actions/upload-artifact@v4
        with:
          name: dacpac
          path: ./MyShopping/bin/Release/*.dacpac
```

Este workflow compila el proyecto con MSBuild y publica el archivo `.dacpac` generado como artefacto del pipeline, para reutilizarlo posteriormente durante el despliegue.

---

## Despliegue continuo: publicar en Azure SQL

Después de una compilación exitosa, queremos publicar los cambios de esquema en la base de datos de destino. Creamos un workflow separado, `cd-database.yml`, que se activa cuando CI termina. **Solo un push aprobado a `master` puede ejecutar el trabajo de despliegue**; los workflows de pull requests se utilizan para validar, no para promover artefactos.

```yaml
name: Database CD - Deploy

on:
  workflow_run:
    workflows: ["Database CI - Build DACPAC"]
    types:
      - completed
    branches:
      - master

permissions:
  actions: read
  contents: read
  id-token: write

jobs:
  deploy-production:
    name: Deploy to Production
    runs-on: windows-latest
    if: >-
      ${{
        github.event.workflow_run.conclusion == 'success' &&
        github.event.workflow_run.event == 'push' &&
        github.event.workflow_run.head_branch == 'master' &&
        github.event.workflow_run.head_repository.full_name == github.repository
      }}
    environment: Production
    
    steps:
      - name: Download DACPAC Artifact
        uses: actions/download-artifact@v4
        with:
          name: dacpac
          run-id: ${{ github.event.workflow_run.id }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          repository: ${{ github.repository }}

      - name: Azure Login
        uses: azure/login@v3
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Install SqlPackage
        run: choco install sqlpackage -y

      - name: Deploy to Production
        shell: pwsh
        run: |
          # Get access token for Azure SQL
          $token = az account get-access-token `
            --resource https://database.windows.net/ `
            --query accessToken -o tsv
            
          # Find the dacpac file
          $dacpac = Get-ChildItem -Filter *.dacpac -Recurse | Select-Object -First 1
          
          if ($null -eq $dacpac) {
            Write-Error "No .dacpac file found!"
            exit 1
          }
          
          # Publish the schema changes
          SqlPackage.exe /Action:Publish `
            /SourceFile:"$($dacpac.FullName)" `
            /TargetServerName:${{ secrets.AZURE_SQL_SERVER }} `
            /TargetDatabaseName:${{ secrets.AZURE_SQL_DATABASE }} `
            /AccessToken:$token `
            /p:BlockOnPossibleDataLoss=true
```

### Cómo funciona

1. **Trigger y límite de confianza:** `workflow_run` comienza al terminar CI, pero el trabajo de despliegue se ejecuta únicamente cuando CI terminó correctamente para un `push` en la rama `master` del mismo repositorio. Una compilación de un PR no debe desplegar su propio artefacto.
2. **Inicio de sesión con Azure OIDC:** nos autenticamos en Azure mediante OpenID Connect (OIDC), evitando almacenar credenciales de larga duración.
3. **Herramienta SqlPackage:** instalamos `sqlpackage` utilizando Chocolatey. Esta utilidad de Microsoft publica el contenido de un DACPAC.
4. **Script de despliegue:**
   - Obtenemos un token de acceso para el recurso de base de datos (`https://database.windows.net/`).
   - Localizamos el archivo `.dacpac` compilado.
   - Ejecutamos `SqlPackage.exe` con `/Action:Publish`, indicando el servidor y la base de datos.
   - **Comprobación de seguridad:** `/p:BlockOnPossibleDataLoss=true` bloquea ciertos despliegues que podrían causar pérdida de datos, pero **no reemplaza** la revisión del script de despliegue generado, las copias de seguridad y un plan de reversión.

---

## Conclusión

Con esta configuración, los pull requests validan el esquema sin desplegarlo. Una ejecución exitosa de CI correspondiente a un push confiable en `master` puede promover el DACPAC a Azure SQL, respetando las protecciones de GitHub Environments y las restricciones de confianza de Azure OIDC.

Revisá siempre los cambios del esquema y mantené un plan de recuperación antes de desplegar en producción.

¡Espero que te resulte útil! ¡Feliz programación! 🧑🏻‍💻 😁

### Referencias
* [Documentación general de Microsoft SqlPackage](https://learn.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage)
* [SSDT SQL Database Projects](https://learn.microsoft.com/en-us/sql/ssdt/sql-server-data-tools)
