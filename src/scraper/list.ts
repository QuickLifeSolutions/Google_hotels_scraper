import { Page } from 'playwright';
import { Log } from 'crawlee';
import { waitWhileGoogleLoading } from './utils.js';
import { GoogleHotelsOptions } from './options.js';
import { DEFAULT_NUM_OF_ADULTS, DEFAULT_NUM_OF_CHILDREN, MAX_NUM_OF_PEOPLE } from '../constants.js';

// define type for callback function
type EnqueueDetails = (urls: string[]) => Promise<void>;

export const getDetailsUrls = async (page: Page, log: Log, options: GoogleHotelsOptions, enqueueDetails: EnqueueDetails) => {
    // Wait for the input element to be present and the page to be loaded
    const element = await page.waitForSelector('input[aria-label="Search for places, hotels and more"]');
    log.info(await element.inputValue());

    await fillInputForm(page, options);
    await waitWhileGoogleLoading(page);
    await page.waitForTimeout(1000);

    // const nextPageButtonSelector = 'main > c-wiz > span > c-wiz > c-wiz:last-of-type > div > button:nth-of-type(2)';
    let hasNextPage = true;
    let pageNumber = 1;
    let totalItems = 0;
    do {
        const items = await page.$$('main > c-wiz > span > c-wiz > c-wiz > div > a');
        log.info(`Found ${items.length} items on the page ${pageNumber}`);
        const urls = await Promise.all(items.map(async (item) => (
            `https://www.google.com${await item.getAttribute('href')}`
        ))) as string[];

        totalItems += items.length;

        const nextPageButton = page.getByRole('button').filter({ hasText: 'Next' }).first();
        // const nextPageButton = await page.$(nextPageButtonSelector);
        if (nextPageButton !== null && totalItems < options.maxResults) {
            await nextPageButton.click();
            await waitWhileGoogleLoading(page);
            await page.waitForTimeout(1000);
            pageNumber++;
        } else {
            hasNextPage = false;
        }

        await enqueueDetails(urls);
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
    await page.waitForTimeout(1000);
    await checkOutElement.fill(options.checkOutDate);
    await checkOutElement.press('Enter');

    const submitButton = await page.waitForSelector('div[role="dialog"] > div:nth-of-type(4) > div > button:nth-of-type(2)');
    await submitButton.click();

    const peopleButton = await page.waitForSelector('div[role="button"][aria-label^="Number of travelers"]');
    await peopleButton.click();
    await page.waitForTimeout(1000);

    let adults = DEFAULT_NUM_OF_ADULTS;
    let children = DEFAULT_NUM_OF_CHILDREN;

    while (adults > options.numberOfAdults && adults > 0) {
        const removeAdultButton = await page.waitForSelector('button[aria-label="Remove adult"]');
        await removeAdultButton.click();
        adults--;
    }
    while (adults < options.numberOfAdults && (adults + children) <= MAX_NUM_OF_PEOPLE) {
        const addAdultButton = await page.waitForSelector('button[aria-label="Add adult"]');
        await addAdultButton.click();
        adults++;
    }
    while (children > options.numberOfChildren && children >= 0) {
        const removeChildButton = await page.waitForSelector('button[aria-label="Remove child"]');
        await removeChildButton.click();
        children--;
    }
    while (children < options.numberOfChildren && (adults + children) <= MAX_NUM_OF_PEOPLE) {
        const addChildButton = await page.waitForSelector('button[aria-label="Add child"]');
        await addChildButton.click();
        children++;
    }

    const peopleDoneButton = await page.waitForSelector(
        'div[data-default-adult-num="2"] > div > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > button',
    );
    await peopleDoneButton.click();

    const currencyButton = await page.waitForSelector('footer div c-wiz button');
    await currencyButton.click();
    await page.waitForTimeout(1000);
    const requiredCurrency = options.currencyCode;
    const currencyRadio = await page.waitForSelector(`div[role="radio"][data-value="${requiredCurrency.toUpperCase()}"]`);
    await currencyRadio.click();
    const currencyDoneButton = await page.waitForSelector('div[aria-label="Select currency"] > div:nth-of-type(3) > div:nth-of-type(2) > button');
    await currencyDoneButton.click();
};
