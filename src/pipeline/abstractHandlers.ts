import {Command, CommandResponse} from './commands';
import {RequestContext} from '../servers/requestContext';
import {Query} from './query';

export abstract class AbstractCommandHandler {
    command: Command;
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