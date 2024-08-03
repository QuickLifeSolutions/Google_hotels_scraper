/**
 * This template is a production ready boilerplate for developing with `PlaywrightCrawler`.
 * Use this to bootstrap your projects using the most up-to-date code.
 * If you're looking for examples or want to learn more, see README.
 */

import { Actor, ProxyConfiguration } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { createGoogleHotelsRouter } from './routes.js';
import { GoogleHotelsOptions } from './scraper/options.js';
import { CONTENT_LANGUAGE_CODE, DEFAULT_MAX_REQUESTS_PER_CRAWL } from './constants.js';

interface Input extends GoogleHotelsOptions {
    proxyConfiguration: ProxyConfiguration;
    maxRequestsPerCrawl: number;
}

// Initialize the Apify SDK
await Actor.init();

const input = await Actor.getInput<Input>() ?? {} as Input;

const {
    searchQuery,
    proxyConfiguration = await Actor.createProxyConfiguration(),
    maxRequestsPerCrawl = DEFAULT_MAX_REQUESTS_PER_CRAWL,
} = input;

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl,
    requestHandler: createGoogleHotelsRouter(input),
});

await crawler.run([`https://www.google.com/travel/search?q=${searchQuery}&hl=${CONTENT_LANGUAGE_CODE}`]);

// Exit successfully
await Actor.exit();
