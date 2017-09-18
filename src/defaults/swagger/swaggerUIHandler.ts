import { LifeTime } from '../../di/annotations';
import { System } from '../../globals/system';
import { VulcainManifest } from '../../dependencies/annotations';
import { QueryHandler } from "../../pipeline/handlers/annotations.handlers";
import { Query } from "../../pipeline/handlers/annotations";
import { RequestContext } from "../../pipeline/requestContext";
import { ForbiddenRequestError } from "../../pipeline/errors/applicationRequestError";
import { HttpResponse } from "../../pipeline/response";
import { SwaggerTemplate } from './swaggerTemplate';

@QueryHandler({ scope: "?", serviceLifeTime: LifeTime.Singleton })
export class SwaggerUIHandler {

    constructor() {
    }

    @Query({ outputSchema: "string", description: "Display Swagger UI", action: "_swagger" })
    displaySwaggerUI() {
        let ctx: RequestContext = (<any>this).requestContext;
        if (ctx.publicPath)
            throw new ForbiddenRequestError();

        let url = '/api/_servicedescription?format=swagger';

        let response = new HttpResponse(SwaggerTemplate.getHtmlRendered('Vulcainjs - Swagger UI', url));
        response.contentType = "text/html";
        return response;
    }
}