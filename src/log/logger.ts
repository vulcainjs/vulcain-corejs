import { EntryKind } from "./vulcainLogger";
import { IRequestContext } from "../pipeline/common";

export interface Logger {
    error(context: IRequestContext, error: Error, msg?: () => string);
    info(context: IRequestContext, msg: () => string);
    verbose(context: IRequestContext, msg: () => string): boolean;
    logAction(context: IRequestContext, kind: EntryKind, message?: string);
}