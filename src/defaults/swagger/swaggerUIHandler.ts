import { LifeTime } from '../../di/annotations';
import { System } from '../../globals/system';
import { VulcainManifest } from '../../globals/manifest';
import { QueryHandler } from "../../pipeline/handlers/annotations.handlers";
import { Query } from "../../pipeline/handlers/annotations";
import { RequestContext } from "../../pipeline/requestContext";
import { ForbiddenRequestError } from "../../pipeline/errors/applicationRequestError";
import { HttpResponse } from "../../pipeline/response";

@QueryHandler({ scope: "?", serviceLifeTime: LifeTime.Singleton })
export class SwaggerUIHandler {

    constructor() {
    }

    @Query({ outputSchema: "string", description: "Display Swagger UI", action: "_swagger" })
    displaySwaggerUI() {
        let ctx: RequestContext = (<any>this).context;
        if (ctx.publicPath)
            throw new ForbiddenRequestError();

        let url = '/api/_servicedescription?format=swagger';

        let template = require('./_swaggerTemplate').SwaggerTemplate;

        let response = new HttpResponse(template.getHtmlRendered('Vulcainjs - Swagger UI', url));
        response.contentType = "text/html";
        return response;
    }
}