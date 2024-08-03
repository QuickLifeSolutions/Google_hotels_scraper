import { Dataset, createPlaywrightRouter } from 'crawlee';
import { skipGoogleConsent } from './scraper/utils.js';
import { GoogleHotelsOptions } from './scraper/options.js';
import { getDetailsUrls } from './scraper/list.js';
import { getHotelItemData } from './scraper/detail.js';

export const createGoogleHotelsRouter = (options: GoogleHotelsOptions) => {
    const router = createPlaywrightRouter();

    router.addDefaultHandler(async ({ request, page, enqueueLinks, log }) => {
        log.info(`enqueueing new URLs`, { url: request.loadedUrl });

        // Get rid of the Google consent dialog
        await skipGoogleConsent(request, page);

        await getDetailsUrls(page, log, options, async (urls) => {
            await enqueueLinks({
                urls,
                strategy: 'same-domain',
                label: 'detail',
            });
        });
    });

    router.addHandler('detail', async ({ request, page, log }) => {
        // Get rid of the Google consent dialog
        await skipGoogleConsent(request, page);
        const item = await getHotelItemData(page, log);
        await Dataset.pushData(item);
    });

    return router;
};
