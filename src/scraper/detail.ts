import { Log } from 'crawlee';
import { Page } from 'playwright';

export interface GoogleHotelItemData {
    url: string;
    title: string;
    website: string;
    address: string;
    phone: string;
    photos: string[];
    rating: number;
    reviews: number;
    prices: {provider: string, price: number, link: string}[];
}

export const getHotelItemData = async (page: Page, log: Log): Promise<GoogleHotelItemData> => {
    const title = await (await page.waitForSelector('h1[role="heading"]')).innerText();

    const pricesTab = await page.waitForSelector('div[id="prices"]');
    const reviewsTab = await page.waitForSelector('div[id="reviews"]');
    const photosTab = await page.waitForSelector('div[id="photos"]');
    const aboutTab = await page.waitForSelector('div[id="details"]');

    await pricesTab.click();
    const pricesBtns = await page.locator('button[aria-label^="Visit site for"]').all();
    // const pricesBtns = await page.$$('button[aria-label^="Visit site for"]');
    const prices = (await Promise.all(pricesBtns.map(async (btn) => {
        const row = btn.locator('..').locator('..');
        const link = await row.locator('..').getAttribute('href');

        if (link != null) {
            const provider = await row.locator('div:nth-of-type(1) > div > span > span').first().innerText();

            const textPrice = await row.locator('div:nth-of-type(2) > span > span > span > span').first().innerText();
            const price = parseFloat(textPrice.replace(/[^0-9.]/g, ''));

            return { provider, price, link: `https://www.google.com/travel${link}` };
        }

        return null;
    }))).filter((price, i, arr) => price !== null && arr.findIndex((o) => o?.provider === price.provider) === i) as GoogleHotelItemData['prices'];

    await reviewsTab.click();
    const reviewText = await page.locator('div[aria-label*="out of"][role="text"]').first().getAttribute('aria-label');
    let rating = 0;
    let reviews = 0;
    if (reviewText !== null) {
        rating = parseFloat(reviewText.substring(0, reviewText.indexOf('out')).trim());
        reviews = parseInt(reviewText.substring(reviewText.indexOf('from'))
            .replace('from', '')
            .replace('reviews', '')
            .replace(',', '')
            .trim(), 10);
    }

    await aboutTab.click();
    const website = (await page.locator('a[aria-label="Website"]').getAttribute('href')) || '';
    const address = (await page.locator('span[aria-label*="hotel address is"]').innerText()) || '';
    const phone = (await page.locator('span[aria-label*="call this hotel"]').innerText()) || '';

    await photosTab.click();
    await page.waitForTimeout(2000);
    const photosElements = await page.locator('span[id="photos"] img[alt*="Photo"]').all();
    const photos = (await Promise.all(photosElements.map(async (photo) => {
        const src = await photo.getAttribute('src');
        if (src !== null) {
            if (src.startsWith('//')) {
                return `https:${src}`;
            }
            return src;
        }
        return null;
    }))).filter((photo) => photo !== null) as string[];

    log.info(`Parsed detail (${title})`, { url: page.url() });

    return {
        url: page.url(),
        title,
        website,
        address,
        phone,
        photos,
        rating,
        reviews,
        prices,
    };
};
