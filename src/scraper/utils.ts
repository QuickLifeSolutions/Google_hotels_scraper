import { Page } from 'playwright';
import { LoadedRequest, Request } from 'crawlee';

/**
 * This function get rid of the Google consent dialog and redirects back to desired page.
 * @param request
 * @param page
 */
export const skipGoogleConsent = async (request: LoadedRequest<Request>, page: Page) => {
    // If the loaded URL is the Google consent dialog, reject all cookies
    if (request.loadedUrl.startsWith('https://consent.google.com')) {
        await page.click('button[aria-label="Reject all"]');
    }
};

/**
 * This function waits for the Google loading spinner to disappear.
 * @param page
 */
export const waitWhileGoogleLoading = async (page: Page) => {
    await page.waitForFunction(async () => {
        const loader = document.querySelector('div[aria-label="Loading results"]');
        return !(loader?.checkVisibility() ?? false);
    });
};
