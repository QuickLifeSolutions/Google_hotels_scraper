import { Page } from 'playwright';
import { LoadedRequest, PlaywrightCrawlingContext, Request } from 'crawlee';
import { waitWhileGoogleLoading } from './utils.js';
import { GoogleHotelsOptions } from './options.js';
import { DEFAULT_NUM_OF_ADULTS, DEFAULT_NUM_OF_CHILDREN, MAX_NUM_OF_PEOPLE } from '../constants.js';

// define type for callback function
type EnqueueDetails = (urls: string[]) => Promise<void>;

export const getDetailsUrls = async <Context extends PlaywrightCrawlingContext>(ctx: Omit<Context, 'request'> & {
    request: LoadedRequest<Request>;
}, options: GoogleHotelsOptions, enqueueDetails: EnqueueDetails) => {
    const { page, log } = ctx;
    // Wait for the input element to be present and the page to be loaded
    const element = await page.waitForSelector('input[aria-label="Search for places, hotels and more"]');
    log.info(await element.inputValue());

    await fillInputForm(page, options);
    await waitWhileGoogleLoading(page);
    const detailLinkSelector = 'main > c-wiz > span > c-wiz > c-wiz > div > a';

    let hasNextPage = true;
    let pageNumber = 1;
    let totalItems = 0;
    do {
        if (options.maxResults !== undefined && totalItems >= options.maxResults) {
            break;
        }

        await page.waitForSelector(detailLinkSelector, { timeout: 15000 });
        const urls = await page.$$eval(detailLinkSelector, (anchors) => anchors
            .map((anchor) => anchor.getAttribute('href'))
            .filter((href): href is string => Boolean(href))
            .map((href) => new URL(href, 'https://www.google.com').toString()));

        log.info(`Found ${urls.length} items on the page ${pageNumber}`);

        if (urls.length === 0) {
            break;
        }

        const remaining = options.maxResults === undefined ? urls.length : Math.max(options.maxResults - totalItems, 0);
        const chunk = options.maxResults === undefined ? urls : urls.slice(0, remaining);

        if (chunk.length > 0) {
            await enqueueDetails(chunk);
            totalItems += chunk.length;
        }

        const nextPageButton = page.getByRole('button', { name: 'Next' }).first();
        const canPaginate = await nextPageButton.isEnabled().catch(() => false);

        if (canPaginate) {
            await nextPageButton.click();
            await waitWhileGoogleLoading(page);
            pageNumber++;
        } else {
            hasNextPage = false;
        }
    } while (hasNextPage);
};

const fillInputForm = async (page: Page, options: GoogleHotelsOptions) => {
    let checkInElement = await page.waitForSelector('input[aria-label="Check-in"]');

    await checkInElement.click();

    checkInElement = await page.waitForSelector(
        'div[role="dialog"] > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > input[aria-label="Check-in"]',
    );
    const checkOutElement = await page.waitForSelector(
        'div[role="dialog"] > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div > div > input[aria-label="Check-out"]',
    );

    await checkInElement.fill(options.checkInDate);
    await checkOutElement.click();
    await checkOutElement.fill(options.checkOutDate);
    await checkOutElement.press('Enter');

    const submitButton = await page.waitForSelector('div[role="dialog"] > div:nth-of-type(4) > div > button:nth-of-type(2)');
    await submitButton.click();

    const peopleButton = await page.waitForSelector('div[role="button"][aria-label^="Number of travelers"]');
    await peopleButton.click();

    let adults = DEFAULT_NUM_OF_ADULTS;
    let children = DEFAULT_NUM_OF_CHILDREN;

    const removeAdultButton = page.locator('button[aria-label="Remove adult"]');
    const addAdultButton = page.locator('button[aria-label="Add adult"]');
    const removeChildButton = page.locator('button[aria-label="Remove child"]');
    const addChildButton = page.locator('button[aria-label="Add child"]');

    while (adults > options.numberOfAdults && adults > 0) {
        await removeAdultButton.click();
        adults--;
    }
    while (adults < options.numberOfAdults && (adults + children) <= MAX_NUM_OF_PEOPLE) {
        await addAdultButton.click();
        adults++;
    }
    while (children > options.numberOfChildren && children >= 0) {
        await removeChildButton.click();
        children--;
    }
    while (children < options.numberOfChildren && (adults + children) <= MAX_NUM_OF_PEOPLE) {
        await addChildButton.click();
        children++;
    }

    const peopleDoneButton = await page.waitForSelector(
        'div[data-default-adult-num="2"] > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > button',
    );
    await peopleDoneButton.click();

    const currencyButton = await page.waitForSelector('footer div c-wiz button');
    await currencyButton.click();
    const requiredCurrency = options.currencyCode;
    const currencyDialog = await page.waitForSelector('div[aria-label="Select currency"]');
    const currencyRadio = await currencyDialog.waitForSelector(`div[role="radio"][data-value="${requiredCurrency.toUpperCase()}"]`);
    await currencyRadio.click();
    const currencyDoneButton = await currencyDialog.waitForSelector('div:nth-of-type(3) > div:nth-of-type(2) > button');
    await currencyDoneButton.click();
};
