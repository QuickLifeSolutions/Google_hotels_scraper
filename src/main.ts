import { Actor, ProxyConfigurationOptions } from 'apify';
import { PlaywrightCrawler } from 'crawlee';
import { Page } from 'playwright';
import { createGoogleHotelsRouter } from './routes.js';
import { GoogleHotelsOptions } from './scraper/options.js';
import {
    CONTENT_LANGUAGE_CODE,
    DEFAULT_MAX_CONCURRENCY,
    DEFAULT_MAX_REQUESTS_PER_CRAWL,
    DEFAULT_MAX_REQUESTS_PER_MINUTE,
    DEFAULT_MIN_CONCURRENCY,
    DEFAULT_REQUEST_HANDLER_TIMEOUT_SECS,
} from './constants.js';

interface Input extends GoogleHotelsOptions {
    proxyConfig: ProxyConfigurationOptions;
    maxRequestsPerCrawl: number;
    maxConcurrency?: number;
    minConcurrency?: number;
    maxRequestsPerMinute?: number;
    requestHandlerTimeoutSecs?: number;
}

// Initialize the Apify SDK
await Actor.init();

const input = await Actor.getInput<Input>() ?? {} as Input;

// validate inputs format
if (!input.checkInDate || input.checkInDate.match(/^\d{4}-\d{2}-\d{2}$/) === null) {
    throw new Error('Invalid check-in date format. Use YYYY-MM-DD.');
}
if (!input.checkOutDate || input.checkOutDate.match(/^\d{4}-\d{2}-\d{2}$/) === null) {
    throw new Error('Invalid check-out date format. Use YYYY-MM-DD.');
}

const proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfig);
const {
    searchQuery,
    maxRequestsPerCrawl = DEFAULT_MAX_REQUESTS_PER_CRAWL,
    maxRequestsPerMinute = DEFAULT_MAX_REQUESTS_PER_MINUTE,
} = input;

const maxConcurrency = input.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
const minConcurrency = Math.min(maxConcurrency, input.minConcurrency ?? DEFAULT_MIN_CONCURRENCY);
const requestHandlerTimeoutSecs = input.requestHandlerTimeoutSecs ?? DEFAULT_REQUEST_HANDLER_TIMEOUT_SECS;

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl,
    maxRequestsPerMinute,
    maxConcurrency,
    minConcurrency,
    requestHandlerTimeoutSecs,
    useSessionPool: true,
    sessionPoolOptions: {
        maxPoolSize: Math.max(10, maxConcurrency * 3),
    },
    requestHandler: createGoogleHotelsRouter(input),
    navigationTimeoutSecs: 45,
    launchContext: {
        launchOptions: {
            headless: true,
            args: [
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-background-networking',
            ],
        },
    },
    preNavigationHooks: [
        async ({ page }, gotoOptions) => {
            const pageWithFlag = page as Page & {
                resourceBlockerInstalled?: boolean;
                consentCookieSet?: boolean;
            };
            if (!pageWithFlag.resourceBlockerInstalled) {
                await page.route('**/*', (route) => {
                    const resourceType = route.request().resourceType();
                    if (resourceType === 'font' || resourceType === 'media') {
                        return route.abort();
                    }
                    return route.continue();
                });
                pageWithFlag.resourceBlockerInstalled = true;
            }

            if (!pageWithFlag.consentCookieSet) {
                await page.context().addCookies([
                    {
                        name: 'CONSENT',
                        value: 'YES+cb.20240710-17-p0.en+F+678',
                        domain: '.google.com',
                        path: '/',
                        httpOnly: false,
                        secure: true,
                    },
                ]);
                pageWithFlag.consentCookieSet = true;
            }

            if (gotoOptions) {
                gotoOptions.waitUntil = gotoOptions.waitUntil ?? 'domcontentloaded';
                gotoOptions.timeout = gotoOptions.timeout ?? 45000;
            }
        },
    ],
});

await crawler.run([`https://www.google.com/travel/search?q=${encodeURIComponent(searchQuery)}&hl=${CONTENT_LANGUAGE_CODE}`]);

// Exit successfully
await Actor.exit();
