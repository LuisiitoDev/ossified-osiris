---
title: 'RickAndMorty.mcp'
description: 'Building an MCP server in C# with the new Visual Studio template: a hands-on example using the Rick and Morty API, tested with MCP Inspector and GitHub Copilot.'
pubDate: 'July 05 2026'
heroImage: '/img/mcp/mcp.png'
tags: ['mcp', 'rick-and-morty', 'api', 'ai-tools']
---

<h2 align="center">
    Model Context Protocol
</h2>

MCP (Model Context Protocol) is an open standard for connecting AI models to external systems like: databases, APIs, code repositories, file systems, internal documentation stores, and enterprise productivity tools. MCP is like a USB-C port for AI applications: just as USB-C is a standard for connecting devices, MCP is a standard for connecting AI models to external systems.

![result](/img/mcp/mcp-diagram.png)


Core components of MCP is

* **MCP Hosts:** Applications (e.g., Claude Desktop, IDEs, AI agents) that use the protocol to integrate external tools and data.
* **MCP Clients:** Components handling secure, 1:1 connections with MCP servers.
* **MCP Servers:** Lightweight, modular services exposing specific capabilities—like file access, API queries, or data analysis—via the protocol.
* **Local Data Sources:** Local files, databases, and system services securely accessed by the servers to perform tasks.
* **Remote Services:** External APIs and internet-based systems connected through the servers.

## Let's see an example

![result](/img/mcp/rick.png)

For this example I created an MCP Server for the Rick And Morty TV Show (yes, I love this show 😁). This server exposes the public [Rick and Morty API](https://rickandmortyapi.com/) as tools that an AI model can call. You can find the complete source code in my GitHub: [LuisiitoDev/RickAndMortyMCP](https://github.com/LuisiitoDev/RickAndMortyMCP).

### Creating the project

Visual Studio does not ship with the MCP template by default, so first of all we need to execute the next command in order to get the templates:

```bash
dotnet new install Microsoft.McpServer.ProjectTemplates
```

This will install the **MCP Server App** template, a project template for creating an MCP server using C# and the official `ModelContextProtocol` package. After that, the template will appear in the "Create a new project" dialog:

![Visual Studio new project dialog showing the MCP Server App template](/img/mcp/1.png)

Then we give a name to the project, in my case I named it `Rick-And-Morty-MCP`:

![Configure your new project with the name Rick-And-Morty-MCP](/img/mcp/2.png)

In the last step we choose the framework (.NET 10) and the **transport type**. I chose `local`, this means the server communicates over **STDIO** (standard input/output), the host launches the server as a child process and they exchange messages through it. This is the typical option when the server runs on the same machine as the AI application:

![Additional information step with framework and transport type options](/img/mcp/3.png)

### Implementing the tools

The template gives us a working server out of the box. All the wiring lives in `Program.cs`, here we register the MCP server, tell it to use the STDIO transport and register our tool classes. I also used [Refit](https://github.com/reactiveui/refit) to create a typed HTTP client for the Rick and Morty API, I recommend you this library, it is really useful:

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

Exposing a tool is really simple, we only need to decorate a method with `[McpServerTool]`. Something important here: the `[Description]` attributes are not just documentation, they are sent to the AI model and the model uses them to decide **when** to call each tool and **how** to fill the parameters, so write them carefully!

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

And that's it! No JSON schemas to write by hand, no protocol plumbing, the SDK generates the tool definitions from the method signatures and the descriptions.

### Testing with MCP Inspector

Before connecting the server to a real AI application, we can test it with the **MCP Inspector**, an official tool for testing and debugging MCP servers. We only need to run the next command:

```bash
npx @modelcontextprotocol/inspector
```

![Terminal running npx @modelcontextprotocol/inspector](/img/mcp/4.png)

The Inspector opens in the browser. Our server uses the STDIO transport, so we configure it with the command that launches the server (in our case `dotnet` pointing to the dll of my MCP server) and click **Connect**:

![MCP Inspector connection screen with STDIO transport selected](/img/mcp/5.png)

Once connected, the Inspector lists all the tools that our server exposes, with the same descriptions we wrote in the C# code. We can run any tool manually, here I ran `get_episode` with `id = 1` and I got the episode *"Pilot" (S01E01)* directly from the Rick and Morty API:

![MCP Inspector connected, running get_episode with id 1 and getting the Pilot episode back](/img/mcp/6.png)

In the **Tools** tab we can see everything the server offers: `get_characters`, `get_character`, `get_episodes`, `get_episode`, and also the `get_random_number` sample tool that comes with the template:

![MCP Inspector Tools tab listing all the tools exposed by the server](/img/mcp/7.png)

I recommend you to always test your MCP servers with the Inspector before connecting them to a real AI application, it will save you a lot of time!

### Using it from GitHub Copilot

Now the fun part! Let's connect the server to a real AI application. GitHub Copilot Chat in Visual Studio supports MCP servers, so after registering our server, the five tools appear in the tools panel ready to be used:

![GitHub Copilot Chat tools panel showing the RickAndMorty MCP server with its 5 tools enabled](/img/mcp/8.png)

Let's ask Copilot something that it can't answer reliably by itself: *"can you give me the first and second episode of Rick And Morty?"*. Look what happens, Copilot decides **by itself** to call the `get_episode` tool twice (one time for each id), and each call maps directly to the C# method that we wrote:

![Copilot Chat answering the question by running get_episode twice, with an arrow pointing to the C# method](/img/mcp/9.png)

Something I really like is that security is part of the flow: before each tool call, Copilot asks for confirmation and shows exactly which tool it wants to run and with which arguments. Nothing executes without our approval:

![Copilot asking for confirmation before running get_episode with id 1 and id 2](/img/mcp/10.png)

The answer comes directly from the live API: *Episode 1: "Pilot" — S01E01* and *Episode 2: "Lawnmower Dog" — S01E02*. Let's try another question, this time the first 10 characters, and Copilot picks the `get_characters` tool with `page = 1`:

![Copilot choosing the get_characters tool for a different question](/img/mcp/11.png)

And there it is! Rick Sanchez, Morty Smith, Summer Smith and the rest of the crew, obtained in real time through our MCP server:

![Copilot listing the first 10 Rick and Morty characters returned by the MCP server](/img/mcp/12.png)

Happy coding!😄

## References

* [Model Context Protocol - Getting Started](https://modelcontextprotocol.io/docs/getting-started/intro)
* [Build an MCP server with C# - Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/ai/quickstarts/build-mcp-server?pivots=visualstudio)
* [The Rick and Morty API](https://rickandmortyapi.com/)

