export interface GoogleHotelsOptions {
    searchQuery: string;
    checkInDate: string;
    checkOutDate: string;
    numberOfAdults: number;
    numberOfChildren: number;
    currencyCode: string;
    maxResults?: number;
}
