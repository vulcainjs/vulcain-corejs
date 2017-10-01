import { ISerializer } from "./serializer";
import { HttpResponse } from "../response";
import { IContainer, DefaultServiceNames, HttpRequest } from "../../index";
import { ApplicationError } from "../errors/applicationRequestError";
import { BadRequestError } from "../errors/badRequestError";

export class DefaultSerializer implements ISerializer {
    private serializer: ISerializer;

    constructor(container: IContainer) {
        this.serializer = container.get<ISerializer>(DefaultServiceNames.Serializer, true);
    }

    deserialize(request: HttpRequest) {
        if (this.serializer) {
            let body = this.deserialize(request);
            if (!body)
                return body;
        }
        if (request.headers["Content-Type"] !== "application/json")
            throw new BadRequestError("Unsupported Media Type");
        
        return (typeof request.body === "object") ? request.body : JSON.parse(request.body);
    }

    serialize(request: HttpRequest, response: HttpResponse) {
        if (this.serializer) {
            let resp = this.serialize(request, response);
            if (!resp)
                return resp;
        }

        if (typeof response.content === "string") {
            response.contentType = "text/plain";
        }
        else {
            response.contentType = "application/json";
            response.encoding = response.encoding || "utf8";
            response.content = JSON.stringify(response.content);
        }
        return response;
    }
}