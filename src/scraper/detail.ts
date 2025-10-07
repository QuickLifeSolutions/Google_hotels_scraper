import { LoadedRequest, PlaywrightCrawlingContext, Request } from 'crawlee';

export interface GoogleHotelItemData {
    url: string;
    title: string;
    website?: string;
    address?: string;
    phone?: string;
    photos: string[];
    thumbnail?: string;
    rating: number;
    priceRange?: string;
    reviews: number;
    prices: { provider: string, price: number, link: string }[];
}

export const getHotelItemData = async <Context extends PlaywrightCrawlingContext>(ctx: Omit<Context, 'request'> & {
    request: LoadedRequest<Request>;
}): Promise<GoogleHotelItemData> => {
    const { page, log } = ctx;
    const title = await page.locator('h1[role="heading"]').last().innerText();

    const url = page.url();

    const pricesTab = await page.waitForSelector('div[id="prices"]');
    const reviewsTab = await page.waitForSelector('div[id="reviews"]');
    const photosTab = await page.waitForSelector('div[id="photos"]');
    const aboutTab = await page.waitForSelector('div[id="details"]');

    await pricesTab.click();
    await page.waitForSelector('button[aria-label^="Visit site for"]', { timeout: 10000 }).catch(() => null);
    const prices = await page.locator('button[aria-label^="Visit site for"]').evaluateAll((buttons) => {
        const seen = new Set<string>();
        const baseUrl = 'https://www.google.com';
        const result: { provider: string; price: number; link: string }[] = [];

        for (const button of buttons) {
            const row = button.parentElement?.parentElement;
            const link = row?.parentElement?.getAttribute('href');
            if (!row || !link) {
                continue;
            }

            const providerNode = row.querySelector<HTMLSpanElement>('div:nth-of-type(1) > div > span > span');
            const priceNode = row.querySelector<HTMLSpanElement>('div:nth-of-type(2) > span > span > span > span');

            if (!providerNode || !priceNode) {
                continue;
            }

            const provider = providerNode.textContent?.trim() ?? '';
            const numericPrice = Number.parseFloat((priceNode.textContent ?? '').replace(/[^0-9.]/g, ''));

            if (!provider || Number.isNaN(numericPrice) || seen.has(provider)) {
                continue;
            }

            seen.add(provider);
            result.push({ provider, price: numericPrice, link: `${baseUrl}/travel${link}` });
        }

        return result;
    }) as GoogleHotelItemData['prices'];

    await reviewsTab.click();
    const reviewText = await page.evaluate(() => {
        const reviewNode = document.querySelector<HTMLElement>('div[aria-label*="out of"][role="text"]');
        return reviewNode?.getAttribute('aria-label') ?? undefined;
    });
    let rating = 0;
    let reviews = 0;
    if (reviewText) {
        rating = parseFloat(reviewText.substring(0, reviewText.indexOf('out')).trim());
        reviews = parseInt(reviewText.substring(reviewText.indexOf('from'))
            .replace('from', '')
            .replace('reviews', '')
            .replace(',', '')
            .trim(), 10);
    }

    await aboutTab.click();

    const address = await page.evaluate(() => {
        const addressNode = document.querySelector<HTMLAnchorElement>('span[aria-label*="hotel address is"]');
        return addressNode?.getAttribute('href') ?? undefined;
    });
    const website = await page.evaluate(() => {
        const websiteNode = document.querySelector<HTMLAnchorElement>('a[aria-label="Website"]');
        return websiteNode?.getAttribute('href') ?? undefined;
    });
    const phone = await page.evaluate(() => {
        const phoneNode = document.querySelector<HTMLSpanElement>('span[aria-label*="call this hotel"]');
        return phoneNode?.textContent?.trim() ?? undefined;
    });

    await photosTab.click();
    await page.waitForSelector('span[id="photos"] img[alt*="Photo"]', { timeout: 10000 }).catch(() => null);
    const photos = await page.locator('span[id="photos"] img[alt*="Photo"]').evaluateAll((imgElements) => {
        const sources: string[] = [];
        for (const img of imgElements) {
            const src = img.getAttribute('src');
            if (!src) {
                continue;
            }
            if (src.startsWith('//')) {
                sources.push(`https:${src}`);
            } else {
                sources.push(src);
            }
        }
        return sources;
    }) as string[];

    log.info(`Parsed detail (${title})`, { url: page.url() });

    const thumbnail = photos.length ? photos[0] : undefined;
    let priceRange: string | undefined;
    if (prices.length === 1) {
        priceRange = `${prices[0].price}`;
    } else if (prices.length > 1) {
        const minPrice = prices.reduce((min, p) => (p.price < min ? p.price : min), prices[0].price);
        const maxPrice = prices.reduce((max, p) => (p.price > max ? p.price : max), prices[0].price);
        priceRange = `${minPrice} - ${maxPrice}`;
    }

    return {
        thumbnail,
        url,
        title,
        website,
        address,
        phone,
        photos,
        rating,
        reviews,
        prices,
        priceRange,
    };
};
