---
title: 'ExtendedMethods.cs: métodos de extensión en C#'
description: 'Cómo funcionan los métodos de extensión de C#, con clases estáticas, la palabra clave this y ejemplos prácticos en .NET.'
pubDate: '2022-03-03'
heroImage: '/img/ExtendedMethods/csharp.jpg'
tags: ['csharp', 'dotnet']
lang: 'es'
---

<h2 align="center">
    Métodos de extensión en C#
</h2>

En mi opinión, los métodos de extensión son una excelente forma de agregar funcionalidades a tipos existentes sin modificar su código fuente original.

Esta característica se introdujo en C# 3.0 y sigue disponible en versiones posteriores del lenguaje. Podés utilizarla en proyectos con .NET Framework, .NET Core y .NET. En .NET Framework, C# 3.0 apareció a partir de la versión 3.5.

#### Algunas consideraciones

* El método de extensión debe ser público y estático.
* La clase que contiene ese método debe ser pública y estática.
* El tipo que queremos extender debe ser el primer parámetro, precedido por la palabra clave `this`.

## Veamos un ejemplo

Creé el siguiente método de extensión para el tipo `string`:

```cs
    public static class StringExtension
    {
        public static Dictionary<char,int> GetHowManyCharactersItHas(this string input)
        {
            Dictionary<char,int> result = new Dictionary<char,int>();
            for (int i = 0; i < input.Length; i++)
            {
                if (result.ContainsKey(input[i])) result[input[i]]++;
                else result.Add(input[i], 1);
            }
            return result;
        }
    }
```

El método es estático, pertenece a una clase estática y su primer parámetro es de tipo `string`, precedido por `this`. Eso indica al compilador que el método estará disponible como extensión para cadenas de texto. Como su nombre sugiere, devuelve un diccionario con cada carácter y la cantidad de veces que aparece.

## Cómo utilizarlo

```cs
    static void Main(string[] args)
    {
        Dictionary<char,int> result = "sadasasasacsas".GetHowManyCharactersItHas();
        foreach (var item in result)
        {
            Console.WriteLine($"Character: {item.Key} - Times: {item.Value}");
        }

        Console.ReadLine();
    }
```

Al ejecutar este código, obtenemos el siguiente resultado:

![Resultado del método de extensión](/img/ExtendedMethods/extended.png)

La salida muestra cada carácter de la cadena y cuántas veces se repite.

Espero que este artículo te resulte útil. 😄

### Referencias
* [Blog de ScottGu](https://weblogs.asp.net/scottgu/new-orcas-language-feature-extension-methods) (13 de marzo de 2007): New "Orcas" Language Feature: Extension Methods
