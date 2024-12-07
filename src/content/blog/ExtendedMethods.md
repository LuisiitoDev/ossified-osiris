---
title: 'ExtendedMethods.cs'
description: 'Developer.SayHello(👋);'
pubDate: 'March 03 2022'
heroImage: '/img/ExtendedMethods/csharp.jpg'
---

<h2 align="center">
    Extended Methods in C#
</h2>

Extended methods is a good approach in my opinion, to extend the functionality of existing types, that allows to developers to extend the functionality of existing types without modifying the original source code. By the way this awesome feature was introduced in C# 3.0 and it's still available, so you can use it in your projects, no matters if it is .NET Framework, .NET Core or .NET, but C# 3.0 is available in .NET Framework from the version 3.5 onwards.

#### Some considerations

* The method which is going to be our extended methods must be public and static.
* The class where our extended method is going to be must be public and static.
* The type that we are going to extend must be the first parameter and preceeded by the keyword "this".


## Let's see an example

I have created the following method of a string type: 

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

Well, this method is static, its class is static and the first parameter is a string type proceeded by the keyword "this", which this tell the compiler that this method is going to be available only for string types. Besides this as the name of the method says, this method return a dictionary with the characters and how many times they are in the string.

## Let's see how to use it

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
if we run this code, we will get the following result:

![result](/img/ExtendedMethods/extended.png)

As an output of this code, we got the each character and how many times it appears in the string.

I hope you enjoy this post, and it was helpful.😄 


### References:
* [ScottGu's Blog](https://weblogs.asp.net/scottgu/new-orcas-language-feature-extension-methods) (March 13, 2007) New "Orcas" Language Feature: Extension Methods
