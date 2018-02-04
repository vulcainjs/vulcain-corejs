export interface ErrorResponse {
    message: string;
    errors?: { [propertyName: string]: string };
}