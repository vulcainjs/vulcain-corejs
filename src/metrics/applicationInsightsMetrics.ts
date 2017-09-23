import { IMetrics } from "./metrics";
import { Inject, DefaultServiceNames } from "../di/annotations";
import { IContainer } from "../di/resolvers";
import { System } from './../globals/system';
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';
import { IRequestTracker, IRequestTrackerFactory } from "./trackers/index";
import { SpanId, SpanKind } from "../trace/span";
import { IRequestContext } from "./../pipeline/common";
import * as url from 'url';

const appInsights = require('applicationinsights');
const Contracts = require('applicationInsights/Declarations/Contracts');
const Util = require('applicationInsights/Library/Util');
class Tracker implements IRequestTracker {
    private error: Error;

    constructor(private ctx: IRequestContext, private id: SpanId, private name: string, private kind: SpanKind, private action: string, private tags) {
    }

    private getDependencyData(duration: number, error: Error, tags) {
        let urlObject = Object.assign({}, this.ctx.request.url);
        urlObject.search = undefined;
        urlObject.hash = undefined;
        let dependencyName = this.name.toUpperCase() + " " + urlObject.pathname;
        let remoteDependency = new Contracts.RemoteDependencyData();
        remoteDependency.type = Contracts.RemoteDependencyDataConstants.TYPE_HTTP;
        remoteDependency.target = urlObject.hostname;
        if (this.id.parentId) {
            remoteDependency.type = Contracts.RemoteDependencyDataConstants.TYPE_AI;
        }
        else {
            remoteDependency.type = Contracts.RemoteDependencyDataConstants.TYPE_HTTP;
        }
        remoteDependency.id = this.id.spanId;
        remoteDependency.name = dependencyName;
        remoteDependency.data = url.format(this.ctx.request.url);
        remoteDependency.duration = Util.msToTimeSpan(duration);
        remoteDependency.success =  !error;
        remoteDependency.properties = tags;
        let data = new Contracts.Data();
        data.baseType = Contracts.DataTypes.REMOTE_DEPENDENCY;
        data.baseData = remoteDependency;
        return data;
    };

    trackError(error: any, tags: any) {
        this.error = error;
    }

    dispose(duration: number, tags) {

        appInsights.client.track(this.getDependencyData(duration, this.error, tags));

        if (this.kind === SpanKind.Command)
            appInsights.client.trackDependency({tags});
        else if (this.kind === SpanKind.Event)
            appInsights.client.trackRequest({tags});
        else if (this.kind === SpanKind.Task)
            appInsights.client.trackRequest({tags});
        else if (this.kind === SpanKind.Request)
            appInsights.client.trackRequest({ tags });
        this.ctx = null;
    }
}


export class ApplicationInsightsMetrics implements IMetrics, IRequestTrackerFactory {
    private static instance: ApplicationInsightsMetrics;

    startSpan(ctx: IRequestContext, id: SpanId, name: string, kind: SpanKind, action: string, tags): IRequestTracker {
        return new Tracker(ctx, id, name, kind, action, tags);
    }

    static create() {
        if (ApplicationInsightsMetrics.instance)
            return ApplicationInsightsMetrics.instance;

        if (!System.isDevelopment) {
            let token = DynamicConfiguration.getPropertyValue<string>("appInsights");
            if (token) {
                try {
                    appInsights.setup(token)
                        .setAutoDependencyCorrelation(false)
                        .setAutoCollectRequests(false)
                        .setAutoCollectPerformance(true)
                        .setAutoCollectExceptions(true)
                        .setAutoCollectDependencies(true) // mongodb, redis, mysql
                        .setAutoCollectConsole(false)
                        .start();

                    appInsights.client.commonProperties = {service: System.serviceName, version: System.serviceVersion };
                    System.log.info(null, () => "Initialize application insights metrics adapter ");
                    ApplicationInsightsMetrics.instance = new ApplicationInsightsMetrics();
                    return ApplicationInsightsMetrics.instance;
                }
                catch (ex) {
                    System.log.error(null, ex, () => "Cannot initialize application insights metrics adapter");
                }
            }
        }
        return null;
    }

    /**
     * Increment a counter metric
     * @param metric Metric name
     * @param customTags Object containing contextuel key value tags
     * @param delta Increment value
     */
    increment(metric: string, customTags?: any, delta: number = 1) {
    }

    /**
     * Track a timing value
     * @param metric Metric name
     * @param duration duration is ms
     * @param customTags Object containing contextuel key value tags
     */
    timing(metric: string, duration: number, customTags?: any) {
    }
}