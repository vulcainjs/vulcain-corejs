import { EntryKind } from "./vulcainLogger";
import { IRequestContext } from "../../pipeline/common";

export interface Logger {
    error(requestContext: IRequestContext, error: Error, msg?: () => string);
    info(requestContext: IRequestContext, msg: () => string);
    verbose(requestContext: IRequestContext, msg: () => string);    
    logRequestStatus(requestContext: IRequestContext, kind: EntryKind);
    logAction(requestContext: IRequestContext, kind: EntryKind, action?: string, message?: string);
                    
}