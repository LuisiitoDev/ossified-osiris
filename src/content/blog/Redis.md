---
title: 'Redis.cs'
description: 'A practical introduction to Azure Cache for Redis with C#: creating the Azure resource and reading or writing data from a .NET API.'
pubDate: '2022-08-22'
heroImage: '/img/Redis/Redis.png'
tags: ['redis', 'azure', 'csharp', 'dotnet']
lang: 'en'
---

<h2 align="center">
    Azure Cache for Redis with C#
</h2>

Redis is an in-memory data store commonly used for caching and other high-performance workloads. Its name originally comes from **Remote Dictionary Server**.

### How does Redis work?

Redis is a key-value data store that supports several data structures and optional expiration times for entries. Applications can use these capabilities to cache frequently accessed information.

### Data types

* **Strings:** text or binary values.
* **Lists:** ordered collections of values.
* **Sets:** unordered collections of unique values.
* **Sorted sets:** ordered collections of unique values associated with scores.

## A small Redis example with C# and Azure Cache for Redis

First, let's create the resource in [Azure Portal](https://portal.azure.com).

1. Find the **Azure Cache for Redis** resource.
    \
    ![Azure Cache for Redis resource](/img/Redis/resource.png)

2. Create the resource as shown in the example:
    \
    ![Create an Azure Cache for Redis resource](/img/Redis/createResource.png)

    1. Select your Azure subscription.
    2. Select an existing resource group or create a new one.
    3. Choose a globally unique cache name.
    4. Choose the location. This historical example uses East US.
    5. Select the cache pricing tier.

3. Once the Redis cache has been created, retrieve its connection string:
    \
    ![Redis connection settings](/img/Redis/conexion.png)

    \
    ![Redis connection string](/img/Redis/cadena.png)

After provisioning the Azure resource, we'll create a C# solution, using a Web API in this example.

Start by installing [StackExchange.Redis](https://www.nuget.org/packages/StackExchange.Redis/), the widely used .NET Redis client maintained by the Stack Exchange ecosystem, also known for [Stack Overflow](https://stackoverflow.com/).

## Using Redis from the API

First, create a class that establishes the Redis connection:

```cs
namespace RedisEjemplo.Cache
{
    public class RedisConnection
    {
        /// <summary>
        /// Service for application configuration
        /// </summary>
        private readonly IConfiguration configuration;

        public RedisConnection(IConfiguration configuration) => this.configuration = configuration;

        /// <summary>
        /// it allows to build connection to Azure Cache Redis
        /// </summary>
        /// <returns></returns>
        public async Task<ConnectionMultiplexer> BuildCacheConnection() =>
            await ConnectionMultiplexer.ConnectAsync(this.configuration["RedisConnectionString"]);
    }
}
```

Then create a class that provides operations against Redis:

```cs
namespace RedisEjemplo.Cache
{
    public class RedisHandle
    {
        /// <summary>
        /// Service to connect with Redis in Azure
        /// </summary>
        private readonly RedisConnection redisConnection;

        public RedisHandle(RedisConnection redisConnection) => this.redisConnection = redisConnection;


        public async Task<bool> SetCacheValue(string key, string value, TimeSpan expiration)
        {
            using var conn = await this.redisConnection.BuildCacheConnection();
            var cache = conn.GetDatabase();
            return await cache.StringSetAsync(key, value, expiry: expiration);
        }

        public async Task<string?> GetValue(string key)
        {
            using var conn = await this.redisConnection.BuildCacheConnection();
            var cache = conn.GetDatabase();
            return await cache.StringGetAsync(key);
        }
    }
}
```

Finally, define a controller that exposes the API endpoints:

```cs
namespace RedisEjemplo.Controllers
{
    [Route("api/[controller]")]
    public class CacheController : Controller
    {
        private TimeSpan DEFAULT_TIME_SPAN = TimeSpan.FromTicks(DateTime.Now.Ticks);
        private readonly RedisHandle handle;

        public CacheController(RedisHandle handle)
        {
            this.handle = handle;
        }


        /// <summary>
        /// Endpoint to create a new value in Redis
        /// </summary>
        /// <param name="key"></param>
        /// <param name="value"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<IActionResult> POST([FromQuery]string key, [FromQuery]string value)
        {
            return Ok(await this.handle.SetCacheValue(key,value,DEFAULT_TIME_SPAN));
        }

        /// <summary>
        /// Endpoint to get a value from Redis
        /// </summary>
        /// <param name="key"></param>
        /// <returns></returns>
        [HttpGet]
        public async Task<IActionResult> GET([FromQuery] string key)
        {
            var result = await this.handle.GetValue(key);
            if (string.IsNullOrEmpty(result)) return NotFound();
            return Ok(result);
        }

    }
}
```

Let's see the result of our example.

**POST:** create a value in Redis.
\
![POST request storing a Redis value](/img/Redis/post.png)

**GET:** retrieve the cached value.
\
![GET request reading a Redis value](/img/Redis/get.png)

We can also connect to Azure Cache for Redis using an extension in Visual Studio Code. The client used in this example was [Redis client for VSCode](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-redis-client).

![Redis client in Visual Studio Code](/img/Redis/cliente.png)

Enjoy! 😄

### References
* [Bigeek: Redis para principiantes](https://blog.bi-geek.com/redis-para-principiantes/) (June 28, 2018)
* [Microsoft: About Azure Cache for Redis](https://docs.microsoft.com/es-es/azure/azure-cache-for-redis/cache-overview) (July 28, 2022)

> **Historical tutorial:** These screenshots and resource-creation steps reflect Azure as it appeared in 2022. Verify current service availability, recommended Azure caching services, pricing and security configuration before following the steps in a new project.
