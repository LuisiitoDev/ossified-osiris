---
title: 'Redis.cs'
description: 'Redis.StringGet("Developer");'
pubDate: '2022-08-22'
heroImage: '/img/Redis/Redis.png'
---

<h2 align="center">
    Azure Cache for Redis en C#
</h2>

Redis en un motor de base de datos en memoria, utilizado para alta disponibilidad de sistemas, significa "Remote Dicitionary Server".

### ¿Cómo funciona Redis?

Redis está basado bajo la estructura de hash, en el cual se tiene una clave y un valor, adicionalmente Redis permite poder establecer tiempos de expiracion para nuestros datos.

### Tipos de Datos

* Strings: Cadenas de texto.
* Lits: Colecciones o lista de cadena de texto.
* Sets: Lista de cadenas de texto sin un orden.
* Sorted Sets: Lista de cadenas de texto ordenadas.


## Veamos a realizar un pequeño ejemplo de Redis en C# con Azure Cache for Redis

Lo primero que debemos realizar es crear nuestro recurso en Azure: portal.azure.com

1. Buscamos el recurso Azure Cache for Redis.
    \
    ![result](/img/Redis/resource.png)

2. Lo siguiente que debemos hacer es crear el recurso, como en el siguiente ejemplo:
    \
    ![result](/img/Redis/createResource.png)

    1. En este paso lo que se debe hacer primero es seleccionar nuestra suscripción de Azure.
    2. Debemos seleccionar nustro grupo de recursos o crear nuevo según sea el caso.
    3. Debemos dar el nombre a nuestro cache, el nombre debe ser único en todo el écosistema Azure.
    4. Debemos seleccionar la ubicación del recurso, en este caso seleccionamos EastUS
    5. Por último seleccionamos el tipo de cache o pricing tier.

3. Una vez creado nuestro redis cache en Azure, debemos obtener la cadena de conexión, como se muestra en la siguiente imagen:
    \
    ![result](/img/Redis/conexion.png)

    \
    ![result](/img/Redis/cadena.png)


Una vez creado y configurado nuestro recurso en Azure, crearemos nuestra solución en C#, en este caso crearemos un WebApi.

Primeramente debemos agregar un nuget muy popular, y recomendado por Microsoft, el cual se llama: [StackExchange.Redis](https://www.nuget.org/packages/StackExchange.Redis/), como dato curioso, el nuget fue creado por [Stack Exchange](https://stackexchange.com/) creadores de [StackOverFlow](https://stackoverflow.com/)

## Veamos como usarlo

Creamos una clase para construir la conexion con Redis

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

Luego creamos una clase para realizar las diversas operaciones sobre Redis


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


Finalmente creamos nuestro controller con nuestros endpoints:

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

Veamos la salida de nuestro ejemplo:

POST: Crear un valor en Redis
\
![result](/img/Redis/post.png)

GET: Obtenemos el valor almacenado
\
![result](/img/Redis/get.png)

Como adicional, nos conectaremos a nuestra base de datos Azure Cache for Redis desde un cliente en Visual Studio Code. El cliente utilizado fue el siguiente: [Redis client for VSCode](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-redis-client)

\

![result](/img/Redis/cliente.png)


Enjoy it! 😄

### References:
* [Bigeek](https://blog.bi-geek.com/redis-para-principiantes/) (28 Junio, 2018) Redis para principiantes
* [Microsoft](https://docs.microsoft.com/es-es/azure/azure-cache-for-redis/cache-overview) (28 Julio, 2022) Acerca de Azure Cache for Redis
