// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import react from '@astrojs/react';

import tailwind from '@astrojs/tailwind';
import rehypeLazyImages from './src/plugins/rehypeLazyImages.mjs';

// https://astro.build/config
export default defineConfig({
    site: 'https://luisiitodev.com',
    integrations: [mdx(), sitemap({ filter: (page) => !/^\/search\/?$/.test(new URL(page).pathname) }), react(), tailwind()],
    markdown: { rehypePlugins: [rehypeLazyImages] },
});