export interface IHttpResponse {
    body: any;
    ok: boolean;
    code: number;
    status: number;
    statusType: number;
    info: boolean;
    clientError: boolean;
    serverError: boolean;
    accepted: boolean;
    noContent: boolean;
    badRequest: boolean;
    unauthorized: boolean;
    notAcceptable: boolean;
    notFound: boolean;
    forbidden: boolean;
    error: any;
    cookies: any;
    httpVersion: string;
    httpVersionMajor: number;
    httpVersionMinor: number;
    cookie(name: string): string;
    headers: any;
    raw_body: any;
    url: string;
    method: string;
    socket: any;
    client: any;
    connection: any;
    on(evt: string, callback: (data: any) => void);
}

export interface IHttpRequest {
    url(url: string): IHttpRequest;
    method(verb: string): IHttpRequest;
    form(options: any): IHttpRequest;
    maxRedirects(nb: number): IHttpRequest;
    followRedirect(flag: boolean): IHttpRequest;
    encoding(encoding: string): IHttpRequest;
    strictSSL(flag: boolean): IHttpRequest;
    httpSignature(data: any): IHttpRequest;
    secureProtocol(protocol:string): IHttpRequest;
    proxy(proxy: string): IHttpRequest;
    timeout(ms: number): IHttpRequest;
    send(data?: any):IHttpRequest;
    end(callback: (response: IHttpResponse) => void);
    on(evt: string, callback: (data: any) => void);
    hasHeader(name: string): boolean;
    stream(): IHttpRequest;
    field(name: string, value: any, options?):IHttpRequest;
    attach(name: string, path: string, options?):IHttpRequest;
    rawField(name: string, value: any, options?):IHttpRequest;
    auth(user: string, password: string, sendImmediately?: boolean): IHttpRequest;
    header(name: string|any, value?: string): IHttpRequest;
    query(value: string): IHttpRequest;
    type(type: string): IHttpRequest;
    part(options: string | any): IHttpRequest;
    json(data):any;
}
