import { HttpResponse } from "../response";
import { HttpRequest } from "../vulcainPipeline";

export interface ISerializer {
    serialize(request: HttpRequest, response: HttpResponse): HttpResponse;
    deserialize(request: HttpRequest): any;
}