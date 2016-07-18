import {CommandData, CommandResponse} from './commands';
import {RequestContext} from '../servers/requestContext';
import {Query} from './query';

export abstract class AbstractCommandHandler {
    command: CommandData;
    requestContext: RequestContext;
}

export abstract class AbstractEventHandler {
    event: CommandResponse;
    requestContext: RequestContext;
}

export abstract class AbstractQueryHandler {
    query: Query;
    requestContext: RequestContext;
}