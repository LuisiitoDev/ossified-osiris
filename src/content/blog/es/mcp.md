---
title: 'RickAndMorty.mcp: un servidor MCP en C#'
description: 'Aprendé a crear un servidor MCP con C#, Visual Studio y la API de Rick y Morty, y a probarlo con MCP Inspector y GitHub Copilot.'
pubDate: '2026-07-05'
heroImage: '/img/mcp/mcp.png'
tags: ['mcp', 'rick-and-morty', 'api', 'ai-tools']
lang: 'es'
---

<h2 align="center">
    Model Context Protocol
</h2>

MCP (*Model Context Protocol*) es un estándar abierto para conectar modelos de inteligencia artificial con sistemas externos, como bases de datos, APIs, repositorios de código, sistemas de archivos, documentación interna y herramientas empresariales. MCP es comparable a un puerto USB-C para aplicaciones de IA: así como USB-C establece una forma estándar de conectar dispositivos, MCP define una manera estándar de integrar herramientas y datos externos.

![Diagrama del Model Context Protocol](/img/mcp/mcp-diagram.png)

Los componentes principales de MCP son:

* **MCP Hosts:** aplicaciones (por ejemplo, Claude Desktop, IDEs o agentes de IA) que utilizan el protocolo para integrar herramientas y datos.
* **MCP Clients:** componentes que administran conexiones seguras de uno a uno con los servidores MCP.
* **MCP Servers:** servicios ligeros y modulares que exponen capacidades específicas, como acceso a archivos, consultas a APIs o análisis de datos.
* **Fuentes de datos locales:** archivos, bases de datos y servicios del sistema a los que acceden los servidores de forma segura.
* **Servicios remotos:** APIs externas y sistemas accesibles por internet conectados mediante los servidores.

## Veamos un ejemplo

![Rick y Morty](/img/mcp/rick.png)

Para este ejemplo creé un servidor MCP para la serie Rick y Morty (¡sí, me encanta esta serie! 😁). El servidor expone la [API pública de Rick y Morty](https://rickandmortyapi.com/) mediante herramientas que un modelo de IA puede ejecutar. Encontrás el código completo en GitHub: [LuisiitoDev/RickAndMortyMCP](https://github.com/LuisiitoDev/RickAndMortyMCP).

### Creación del proyecto

Visual Studio no incorpora esta plantilla MCP de forma predeterminada, así que primero debemos instalar las plantillas ejecutando:

```bash
dotnet new install Microsoft.McpServer.ProjectTemplates
```

Esto instala **MCP Server App**, una plantilla para crear servidores MCP con C# y el paquete oficial `ModelContextProtocol`. Después aparecerá en el cuadro de diálogo para crear un proyecto:

![Crear proyecto en Visual Studio con la plantilla MCP Server App](/img/mcp/1.png)

Asignamos un nombre; en mi caso utilicé `Rick-And-Morty-MCP`:

![Configurar el proyecto Rick-And-Morty-MCP](/img/mcp/2.png)

En el último paso seleccionamos el framework (.NET 10) y el **tipo de transporte**. Elegí `local`: el servidor se comunica mediante **STDIO** (entrada y salida estándar), mientras el host inicia el servidor como un proceso hijo e intercambia mensajes con él. Es una opción habitual cuando el servidor y la aplicación de IA se ejecutan en el mismo equipo.

![Seleccionar .NET 10 y el tipo de transporte local](/img/mcp/3.png)

### Implementación de las herramientas

La plantilla genera un servidor funcional. La configuración está en `Program.cs`: registramos el servidor MCP, seleccionamos el transporte STDIO y agregamos las clases de herramientas.

También utilicé [Refit](https://github.com/reactiveui/refit) para crear un cliente HTTP tipado para la API de Rick y Morty. Es una biblioteca que recomiendo por su utilidad.

```csharp
var builder = Host.CreateApplicationBuilder(args);

builder.Logging.AddConsole(o => o.LogToStandardErrorThreshold = LogLevel.Trace);

builder.Services
    .AddRefitClient<IRickAndMortyService>()
    .ConfigureHttpClient(c => c.BaseAddress = new Uri("https://rickandmortyapi.com/api"));

builder.Services
    .AddMcpServer()
    .WithStdioServerTransport()
    .WithTools<RandomNumberTools>()
    .WithTools<RickAndMortyTools>();

await builder.Build().RunAsync();
```

Exponer una herramienta es sencillo: basta con decorar un método con `[McpServerTool]`. Un detalle importante: los atributos `[Description]` no son únicamente documentación. Se envían al modelo de IA, que los utiliza para decidir **cuándo** llamar a cada herramienta y **cómo** completar sus parámetros. Por eso debemos escribir descripciones precisas.

```csharp
internal class RickAndMortyTools(IRickAndMortyService rickAndMortyService)
{
    [McpServerTool]
    [Description("Gets a page of characters from the Rick And Morty TV Show, optionally filtered by name, status, species, type or gender")]
    public Task<PagedResponse<Character>> GetCharacters(
        [Description("Page number")] int? page = null,
        [Description("Filter by name")] string? name = null,
        [Description("Filter by status (alive, dead or unknown)")] string? status = null,
        [Description("Filter by species")] string? species = null,
        [Description("Filter by type")] string? type = null,
        [Description("Filter by gender (female, male, genderless or unknown)")] string? gender = null)
        => rickAndMortyService.GetCharactersAsync(page, name, status, species, type, gender);

    [McpServerTool]
    [Description("Gets a single episode from the Rick And Morty TV Show by its id")]
    public Task<Episode> GetEpisode([Description("The episode id")] int id)
        => rickAndMortyService.GetEpisodeAsync(id);

    // ... GetCharacter and GetEpisodes follow the same pattern
}
```

¡Y eso es todo! No necesitamos escribir manualmente los esquemas JSON ni implementar los detalles internos del protocolo. El SDK genera las definiciones de las herramientas a partir de las firmas de los métodos y sus descripciones.

### Pruebas con MCP Inspector

Antes de conectar el servidor a una aplicación real de IA, podemos probarlo con **MCP Inspector**, una herramienta oficial para comprobar y depurar servidores MCP. Solo necesitamos ejecutar:

```bash
npx @modelcontextprotocol/inspector
```

![Terminal ejecutando MCP Inspector](/img/mcp/4.png)

Inspector se abre en el navegador. Como nuestro servidor utiliza STDIO, lo configuramos con el comando que inicia el servidor (en este caso `dotnet`, apuntando a la DLL del servidor MCP) y seleccionamos **Connect**:

![Conexión de MCP Inspector mediante STDIO](/img/mcp/5.png)

Al conectarse, Inspector muestra todas las herramientas expuestas por el servidor, con las mismas descripciones que escribimos en C#. Podemos ejecutarlas manualmente. Aquí ejecuté `get_episode` con `id = 1` y obtuve el episodio *«Pilot» (S01E01)* directamente desde la API:

![Ejecución de get_episode con id 1 desde MCP Inspector](/img/mcp/6.png)

En la pestaña **Tools** aparecen `get_characters`, `get_character`, `get_episodes`, `get_episode` y también la herramienta de ejemplo `get_random_number`, incluida en la plantilla:

![Herramientas disponibles en el servidor MCP](/img/mcp/7.png)

Te recomiendo probar siempre tus servidores MCP con Inspector antes de conectarlos a una aplicación real. ¡Te puede ahorrar mucho tiempo!

### Uso desde GitHub Copilot

¡Ahora viene la parte divertida! Conectemos el servidor a una aplicación de IA. GitHub Copilot Chat en Visual Studio admite servidores MCP. Después de registrar el nuestro, las cinco herramientas aparecen disponibles en el panel:

![Panel de herramientas de GitHub Copilot Chat mostrando el servidor MCP](/img/mcp/8.png)

Hagámosle a Copilot una pregunta que no puede responder de forma confiable sin consultar datos externos: *«¿Podés decirme cuáles son el primer y el segundo episodio de Rick y Morty?»*. Observá lo que ocurre: Copilot decide **por sí mismo** ejecutar `get_episode` dos veces, una por cada ID. Cada llamada corresponde al método C# que implementamos:

![Copilot ejecutando get_episode dos veces](/img/mcp/9.png)

Algo que me gusta especialmente es que la seguridad forma parte de este flujo: antes de cada llamada, Copilot solicita confirmación y muestra cuál herramienta quiere ejecutar y qué argumentos enviará. En esta demostración no se ejecuta nada sin nuestra aprobación:

![Confirmación de Copilot antes de llamar a get_episode](/img/mcp/10.png)

La respuesta llega directamente desde la API: *Episodio 1: «Pilot» — S01E01* y *Episodio 2: «Lawnmower Dog» — S01E02*. Probemos otra pregunta, esta vez sobre los primeros diez personajes. Copilot selecciona `get_characters` con `page = 1`:

![Copilot seleccionando get_characters](/img/mcp/11.png)

¡Ahí están! Rick Sánchez, Morty Smith, Summer Smith y otros personajes, obtenidos en tiempo real mediante nuestro servidor MCP:

![Lista de los primeros diez personajes de Rick y Morty](/img/mcp/12.png)

¡Feliz programación! 😄

## Referencias

* [Model Context Protocol - Guía de inicio](https://modelcontextprotocol.io/docs/getting-started/intro)
* [Crear un servidor MCP con C# - Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/ai/quickstarts/build-mcp-server?pivots=visualstudio)
* [La API de Rick y Morty](https://rickandmortyapi.com/)
