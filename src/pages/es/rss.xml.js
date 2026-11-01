import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = (await getCollection('blog'))
    .filter((post) => post.id.startsWith('es/'))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return rss({
    title: 'LuisiitoDev — Artículos en español',
    description: 'Artículos técnicos en español sobre .NET, Azure, DevOps, arquitectura e inteligencia artificial.',
    site: context.site,
    items: posts.map((post) => ({
      ...post.data,
      link: `/es/${post.id.slice(3)}/`,
    })),
  });
}
