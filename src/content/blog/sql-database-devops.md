---
title: 'SQL Database DevOps'
description: 'Automating SQL Server deployments using DACPAC and GitHub Actions.'
pubDate: 'Jun 03 2026'
heroImage: '/img/SQLDataBaseDevOps/hero.png'
---

<h2 align="center">
    SQL Server DevOps: CI/CD with DACPAC and GitHub Actions
</h2>

Hello friends! Today I want to share something very cool that I have been working on. If you are a developer, probably you already know how painful it can be to manage database updates. In many projects, we use migrations files, but sometimes it is better to manage the database schema as state-based. 

In this post, we will look forward how to configure a SQL Server Database Project (`.sqlproj`), build it into a `.dacpac` file, and deploy it automatically to Azure SQL using GitHub Actions! 🧑🏻‍💻

You can check all the code of this implementation in my GitHub repository: [SQLDataBaseDevOps](https://github.com/LuisiitoDev/SQLDataBaseDevOps).

---

## What is a SQL Project and DACPAC?

First thing we have to understand is what is a SQL Project. A SQL Project allows to developers to define the database schema (tables, views, stored procedures) as declarative scripts. Instead of writing migration scripts like `ALTER TABLE`, we just write `CREATE TABLE` and let the tooling do the magic.

When we build this project, it compiles into a single file called **DACPAC** (Data-tier Application Package). This file contains the complete schema representation of our database.

---

## Anatomy of the SQL Project

Let's see the structure of our project. We have a `.sqlproj` file called `MyShopping.sqlproj`. This file tells the compiler how to build the database schema. In our case, we target Azure SQL Database:

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

As you see, the target database provider is configured as `SqlAzureV12DatabaseSchemaProvider` which is perfect for Azure SQL Database. Also, we include our tables inside the `Tables` folder.

Inside `Tables/Song.sql`, we define our table structure. Notice that it is a standard `CREATE TABLE` statement:

```sql
CREATE TABLE [dbo].[Song]
(
    [Id] INT NOT NULL PRIMARY KEY,
    [Name] VARCHAR(500) NOT NULL,
    [Author] VARCHAR(500) NOT NULL,
)
```

If we want to add new columns in the future, we just edit this file directly. No need to create a new migration script!

---

## Continuous Integration: Building the DACPAC

To build the database project automatically, we created a GitHub Actions workflow called `ci-database.yml`. 

Because `.sqlproj` is a classic .NET project format, we need MSBuild to compile it. For this reason, we run the build on a Windows runner:

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

Well, this workflow compiles the project using MSBuild and uploads the generated `.dacpac` file as a pipeline artifact so we can use it in the deployment pipeline.

---

## Continuous Deployment: Deploying to Azure SQL

After the build is successful, we want to publish the schema changes to our target database. To do it, we created a separate CD workflow `cd-database.yml` that is triggered automatically when the CI build finishes:

```yaml
name: Database CD - Deploy

on:
  workflow_run:
    workflows: ["Database CI - Build DACPAC"]
    types:
      - completed

permissions:
  actions: read
  contents: read
  id-token: write

jobs:
  deploy-development:
    name: Deploy to Development
    runs-on: windows-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
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
        uses: azure/login@v1
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Install SqlPackage
        run: choco install sqlpackage -y

      - name: Deploy to Development
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

### Let's see how this works:

1. **Trigger**: The workflow starts when the CI workflow finishes successfully.
2. **Azure OIDC Login**: It logs in to Azure using OpenID Connect (OIDC) which is a very secure practice because we do not store long-lived credentials.
3. **SqlPackage Tool**: We install `sqlpackage` using Chocolatey. This command-line utility is what Microsoft provides to publish DACPACs.
4. **Deploy Script**:
   - We get an access token for database resource (`https://database.windows.net/`).
   - We locate the compiled `.dacpac` file.
   - We execute `SqlPackage.exe` with `/Action:Publish` pointing to our server and database.
   - **Crucial Setting**: We set `/p:BlockOnPossibleDataLoss=true` to prevent any unintended data loss if a schema change would drop a table or column with data.

---

## Wrap up

With this setup, every time you push code to `master` or merge a Pull Request, GitHub Actions will compile your database schema, ensure there are no syntax errors, and deploy it safely to Azure SQL Database. This is a very clean way to achieve Database DevOps and avoid manual configurations.

I hope that it could be helpfull, Happy coding!!! 🧑🏻‍💻 😁

### References:
* [Microsoft SqlPackage Overview](https://learn.microsoft.com/en-us/sql/tools/sqlpackage/sqlpackage)
* [SSDT SQL Database Projects](https://learn.microsoft.com/en-us/sql/ssdt/sql-server-data-tools)
