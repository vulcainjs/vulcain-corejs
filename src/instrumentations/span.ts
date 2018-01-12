import { RequestContext, VulcainHeaderNames } from "../pipeline/requestContext";
import { Service } from "../globals/system";
import { IContainer } from '../di/resolvers';
import { DefaultServiceNames } from '../di/annotations';
import { Logger } from "../log/logger";
import { IMetrics, MetricsFactory } from "../instrumentations/metrics";
import { Pipeline } from './../pipeline/common';
import { IRequestTracker, IRequestTrackerFactory } from '../instrumentations/trackers/index';
import { EntryKind } from "../log/vulcainLogger";
import { ISpanTracker, TrackerId, SpanKind } from "./common";
import * as os from 'os';

// Metrics use the RED method https://www.weave.works/blog/prometheus-and-kubernetes-monitoring-your-applications/
export class Span implements ISpanTracker {
    private _logger: Logger;
    private tags: { [name: string]: string } = {};
    private startTick: [number, number];
    private startTime: number;
    private error: Error;
    private metrics: IMetrics;
    private _id: TrackerId;
    private _tracker: IRequestTracker;
    public action: string;
    private commandType: string;

    get id() {
        return this._id;
    }

    get tracker() {
        return this._tracker;
    }

    private constructor(public context: RequestContext, public kind: SpanKind, private name: string, parent: TrackerId | ISpanTracker) {
        this._logger = context.container.get<Logger>(DefaultServiceNames.Logger);

        this.startTime = Date.now();
        this.startTick = process.hrtime();

        let parentId = <TrackerId>parent;
        if ((<ISpanTracker>parent).id) {
            parentId = (<ISpanTracker>parent).id;
        }

        this._id = <TrackerId>{
            correlationId:  parentId.correlationId,
            spanId: !parentId.spanId ? parentId.correlationId : this.randomTraceId(),
            parentId: parentId.spanId
        };

        this.metrics = context.container.get<IMetrics>(DefaultServiceNames.Metrics);

        this.tags["name"] = name;
        this.tags["domain"] = Service.domainName;
        this.tags["host"] = os.hostname();

        this.convertKind();
    }

    static createRequestTracker(context: RequestContext, parentId: TrackerId) {
        return new Span(context, SpanKind.Request, Service.fullServiceName, parentId);
    }

    createCommandTracker(context: RequestContext, commandName: string) {
        return new Span(context, SpanKind.Command, commandName, this);
    }

    trackAction(action: string, tags?: {[index:string]:string}) {
        if (!action || action.startsWith('_'))
            return;

        this.action = action;

        let trackerFactory = this.context.container.get<IRequestTrackerFactory>(DefaultServiceNames.RequestTracker, true);
        if (trackerFactory) {
            this._tracker = trackerFactory.startSpan(this, this.name, this.action);
        }

        this.tags["action"] = action;
        tags && this.addTags(tags);
        this.logAction("Log", `...Action : ${action}, ${(tags && JSON.stringify(tags)) || ""}`);

        if (this.kind === SpanKind.Command) {
            this.addTag("span.kind", "client");
            this.tags["type"] = "Command";
            this.logAction("BC", `Command: ${this.name}`);
        }
        else if (this.kind === SpanKind.Request) {
            this.addTag("span.kind", "server");
            this.tags["type"] = "Service";
            this.logAction("RR", `Request: ${this.name}`);
        }
        else if (this.kind === SpanKind.Task) {
            this.addTag("span.kind", "server");
            this.tags["type"] = "Task";
            this.logAction("RT", `Async task: ${this.name}`);
        }
        else if (this.kind === SpanKind.Event) {
            this.addTag("span.kind", "consumer");
            this.tags["type"] = "Event";
            this.logAction("RE", `Event: ${this.name}`);
        }
    }

    private convertKind() {
        if (this.kind === SpanKind.Command)
            return;

        if (this.context.pipeline === Pipeline.AsyncTask) {
            this.kind = SpanKind.Task;
            this.name = "Async:" + this.name;
        }
        else if (this.context.pipeline === Pipeline.Event) {
            this.kind = SpanKind.Event;
            this.name = "Event:" + this.name;
        }
    }

    injectHeaders(headers: (name: string | any, value?: string) => any) {
        headers(VulcainHeaderNames.X_VULCAIN_PARENT_ID, this._id.spanId);
        headers(VulcainHeaderNames.X_VULCAIN_CORRELATION_ID, this._id.correlationId);
//        headers(VulcainHeaderNames.X_VULCAIN_SERVICE_NAME, System.serviceName);
//        headers(VulcainHeaderNames.X_VULCAIN_SERVICE_VERSION, System.serviceVersion);
//        headers(VulcainHeaderNames.X_VULCAIN_ENV, System.environment);
//        headers(VulcainHeaderNames.X_VULCAIN_CONTAINER, os.hostname());

        // TODO move this code
        if (this.context.request.headers[VulcainHeaderNames.X_VULCAIN_REGISTER_STUB]) {
            headers(VulcainHeaderNames.X_VULCAIN_REGISTER_STUB, <string>this.context.request.headers[VulcainHeaderNames.X_VULCAIN_REGISTER_STUB]);
        }
        if (this.context.request.headers[VulcainHeaderNames.X_VULCAIN_USE_STUB]) {
            headers(VulcainHeaderNames.X_VULCAIN_USE_STUB, <string>this.context.request.headers[VulcainHeaderNames.X_VULCAIN_USE_STUB]);
        }
    }

    dispose() {
        this.tags["tenant"] = this.context.user.tenant;

        if (this.kind === SpanKind.Command)
            this.endCommand();
        else
            this.endRequest();

        if (this._tracker) {
            this._tracker.finish();
            this._tracker = null;
        }
        this.context = null;
        this._logger = null;
    }

    endCommand() {
        if (this.action) { // for ignored requests like _servicedependency
            this.tags["error"] = this.error ? "true" : "false";
            let metricsName = `vulcain_${this.commandType.toLowerCase()}command_duration_ms`;
            this.metrics.timing(metricsName, this.durationInMs, this.tags);
        }

        // End Command trace
        this._logger && this._logger.logAction(this.context, "EC", `Command: ${this.name} completed with ${this.error ? this.error.message : 'success'}`);
    }

    private endRequest() {
        if (this.action) { // for ignored requests like _servicedependency
            let hasError = !!this.error || !this.context.response || this.context.response.statusCode && this.context.response.statusCode >= 400;
            this.tags["error"] = hasError ? "true" : "false";
            this.metrics.timing("vulcain_service_duration_ms", this.durationInMs, this.tags);
        }

        if (this.kind === SpanKind.Request) {
            this.logAction("ER", `End request status: ${(this.context.response  && this.context.response.statusCode) || 200}`);
        }
        else if (this.kind === SpanKind.Task) {
            this.logAction("ET", `Async task: ${this.name} completed with ${this.error ? this.error.message : 'success'}`);
        }
        else if (this.kind === SpanKind.Event) {
            this.logAction("EE", `Event ${this.name} completed with ${this.error ? this.error.message : 'success'}`);
        }
    }

    addHttpRequestTags(uri: string, verb: string) {
        this.commandType = "Http";
        this.addTag("http.url", uri);
        this.addTag("http.method", verb);
        // http.status_code
    }

    addProviderCommandTags(address: string, schema: string, tenant: string) {
        this.commandType = "Database";
        this.addTag("db.instance",  Service.removePasswordFromUrl(address));
        this.addTag("db.schema", schema);
        this.addTag("db.tenant", tenant);
    }

    addServiceCommandTags(serviceName: string, serviceVersion: string) {
        this.commandType = "Service";
        this.addTag("peer.address", Service.createContainerEndpoint(serviceName, serviceVersion));
        this.addTag("peer.service", "vulcain");
        this.addTag("peer.service_version", serviceVersion);
        this.addTag("peer.service_name", serviceName);
    }
    addCustomCommandTags(commandType: string, tags: { [key: string]: string }) {
        this.commandType = commandType;
        this.addTags(tags);
    }

    addTag(name: string, value: string) {
        if (name && value) {
            try {
                if (typeof value === "object") {
                    value = JSON.stringify(value);
                }
                this.tags[name] = value;
                this._tracker && this._tracker.addTag(name, value);
            }
            catch (e) {
                this.context.logError(e);
                // then ignore
            }
        }
    }

    addTags(tags) {
        if (!tags)
            return;

        Object.keys(tags)
            .forEach(key => this.addTag(key, tags[key]));
    }

    private logAction(action: EntryKind, message: string) {
        this._logger.logAction(this.context, action, message);
    }

    /**
     * Log an error
     *
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     */
    logError(error: Error, msg?: () => string) {
        if (!this.error) {
            this.error = error; // Catch only first error
            if (this._tracker) {
                this._tracker.trackError(error, msg && msg());
            }
        }
        this._logger.error(this.context, error, msg);
    }

    /**
     * Log a message info
     *
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logInfo(msg: () => string) {
        this._logger.info(this.context, msg);
        if (this._tracker) {
            this._tracker.log(msg());
        }
    }

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} context Current context
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logVerbose(msg: () => string) {
        const ok = this._logger.verbose(this.context, msg);
        if (ok && this._tracker) {
            this._tracker.log(msg());
        }
    }

    get now() {
        return this.startTime + this.durationInMs;
    }

    get durationInMs() {
        const endTime = process.hrtime();
     //   const elapsedMicros = Math.floor(hrtime[0] * 1000 + hrtime[1] / 1000000);
     //   return elapsedMicros;
        const secondDiff = endTime[0] - this.startTick[0]
        const nanoSecondDiff = endTime[1] - this.startTick[1]
        const diffInNanoSecond = secondDiff * 1e9 + nanoSecondDiff

        return diffInNanoSecond / 1e6
    }

    private randomTraceId() {
        const digits = '0123456789abcdef';
        let n = '';
        for (let i = 0; i < 16; i++) {
            const rand = Math.floor(Math.random() * 16);
            n += digits[rand];
        }
        return n;
    }
}