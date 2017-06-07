export interface IHttpCommandResponse {
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

export interface IHttpCommandRequest {
    url(url: string): IHttpCommandRequest;
    method(verb: string): IHttpCommandRequest;
    form(options: any): IHttpCommandRequest;
    maxRedirects(nb: number): IHttpCommandRequest;
    followRedirect(flag: boolean): IHttpCommandRequest;
    encoding(encoding: string): IHttpCommandRequest;
    strictSSL(flag: boolean): IHttpCommandRequest;
    httpSignature(data: any): IHttpCommandRequest;
    secureProtocol(protocol:string): IHttpCommandRequest;
    proxy(proxy: string): IHttpCommandRequest;
    timeout(ms: number): IHttpCommandRequest;
    send(data?: any):IHttpCommandRequest;
    end(callback: (response: IHttpCommandResponse) => void);
    on(evt: string, callback: (data: any) => void);
    hasHeader(name: string): boolean;
    stream(): IHttpCommandRequest;
    field(name: string, value: any, options?):IHttpCommandRequest;
    attach(name: string, path: string, options?):IHttpCommandRequest;
    rawField(name: string, value: any, options?):IHttpCommandRequest;
    auth(user: string, password: string, sendImmediately?: boolean): IHttpCommandRequest;
    header(name: string|any, value?: string): IHttpCommandRequest;
    query(value: string): IHttpCommandRequest;
    type(type: string): IHttpCommandRequest;
    part(options: string | any): IHttpCommandRequest;
    json(data):any;
}
