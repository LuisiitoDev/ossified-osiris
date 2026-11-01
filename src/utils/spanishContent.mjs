import { translatedArticleSlugs } from './i18n.mjs';

// Human-reviewed listing translations; these do not imply translated article bodies.
export const spanishPostSummaries = {
  howigotmygithubactionscert: {
    title: 'Cómo obtuve mi certificación de GitHub Actions',
    description: 'Mi experiencia de preparación para GH-200 y lo que representa este logro para mi camino en DevOps.',
  },
  platziconf2026: {
    title: 'Mi experiencia en Platzi Conf Bogotá 2026',
    description: 'Aprendizajes de conferencias sobre open source, inteligencia artificial e ingeniería de software.',
  },
  'github-actions-docker-container-apps': {
    title: 'React + Docker + GitHub Actions',
    description: 'Compilar una aplicación React, publicar su imagen en GitHub Container Registry y desplegarla en Azure Container Apps.',
  },
  mcp: {
    title: 'RickAndMorty.mcp',
    description: 'Cómo construir un servidor MCP en C# utilizando Visual Studio, MCP Inspector y GitHub Copilot.',
  },
  'sql-database-devops': {
    title: 'DevOps para bases de datos SQL',
    description: 'Crear un DACPAC y desplegar cambios de esquema en Azure SQL utilizando GitHub Actions, MSBuild y OIDC.',
  },
  howigetmyazurecert: {
    title: 'Cómo obtuve mi certificación Azure Developer Associate',
    description: 'Recursos, consejos y experiencia de preparación para el examen AZ-204.',
  },
  azureb2c: {
    title: 'Autenticación con Azure AD B2C',
    description: 'Configurar políticas de autenticación personalizadas, Facebook y una aplicación .NET.',
  },
  redis: {
    title: 'Redis.cs',
    description: 'Guía práctica de Azure Cache for Redis con C#, lectura y escritura de datos desde .NET.',
  },
  hellofriend: {
    title: 'HelloFriend.cs',
    description: 'Mi presentación personal y el comienzo de mi blog sobre ingeniería de software.',
  },
  extendedmethods: {
    title: 'Métodos de extensión en C#',
    description: 'Cómo extender tipos existentes con métodos estáticos y la palabra clave this.',
  },
};

export function spanishListing(post) {
  const translation = spanishPostSummaries[post.id];
  return {
    title: translation?.title || post.data.title,
    description: translation?.description || post.data.description,
    hasSpanishArticle: translatedArticleSlugs.has(post.id),
  };
}
