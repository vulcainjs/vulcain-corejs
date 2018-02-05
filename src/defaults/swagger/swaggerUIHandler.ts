import { LifeTime } from '../../di/annotations';
import { Service } from '../../globals/system';
import { VulcainManifest } from '../../globals/manifest';
import { RequestContext } from "../../pipeline/requestContext";
import { ForbiddenRequestError } from "../../pipeline/errors/applicationRequestError";
import { HttpResponse } from "../../pipeline/response";
import { Query } from '../../pipeline/handlers/query/annotations.query';
import { QueryHandler } from '../../pipeline/handlers/query/annotations.queryHandler';

@QueryHandler({ scope: "?", serviceLifeTime: LifeTime.Singleton })
export class SwaggerUIHandler {

    @Query({ outputSchema: "string", description: "Display Swagger UI", name: "_swagger" }, {system:true})
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