import { IMetrics } from "../metrics";
import { Inject, DefaultServiceNames } from "../../di/annotations";
import { IContainer } from "../../di/resolvers";
import { System } from '../../globals/system';
import { DynamicConfiguration } from '../../configurations/dynamicConfiguration';
import { IRequestTracker, IRequestTrackerFactory } from "../trackers/index";
import { IRequestContext } from "../../pipeline/common";
import * as url from 'url';
import { TrackerId, SpanKind } from "../../instrumentations/common";
/*
const appInsights = require('applicationinsights');
class Tracker implements IRequestTracker {
    private error: Error;
    private tags;

    constructor(private ctx: IRequestContext, private id: TrackerInfo, private name: string, private kind: SpanKind, private action: string) {
    }

    private getDependencyData(duration: number, error: Error, tags) {
        let urlObject = Object.assign({}, this.ctx.request.url);
        urlObject.search = undefined;
        urlObject.hash = undefined;
        let dependencyName = this.name.toUpperCase() + " " + urlObject.pathname;
        let remoteDependency = new appInsights.Contracts.RemoteDependencyData();
        remoteDependency.type = appInsights.Contracts.RemoteDependencyDataConstants.TYPE_HTTP;
        remoteDependency.target = urlObject.hostname;
        if (this.id.parentId) {
            remoteDependency.type = appInsights.Contracts.RemoteDependencyDataConstants.TYPE_AI;
        }
        else {
            remoteDependency.type = appInsights.Contracts.RemoteDependencyDataConstants.TYPE_HTTP;
        }
        remoteDependency.id = this.id.spanId;
        remoteDependency.name = dependencyName;
        remoteDependency.data = url.format(this.ctx.request.url);
        remoteDependency.duration = this.msToTimeSpan(duration);
        remoteDependency.success =  !error;
        remoteDependency.properties = tags;
        let data = new appInsights.Contracts.Data();
        data.baseType = appInsights.Contracts.DataTypes.REMOTE_DEPENDENCY;
        data.baseData = remoteDependency;
        return data;
    };

    trackError(error: any) {
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

    private msToTimeSpan(totalms) {
        if (isNaN(totalms) || totalms < 0) {
            totalms = 0;
        }
        let sec = ((totalms / 1000) % 60).toFixed(7).replace(/0{0,4}$/, "");
        let min = "" + Math.floor(totalms / (1000 * 60)) % 60;
        let hour = "" + Math.floor(totalms / (1000 * 60 * 60)) % 24;
        let days = Math.floor(totalms / (1000 * 60 * 60 * 24));
        sec = sec.indexOf(".") < 2 ? "0" + sec : sec;
        min = min.length < 2 ? "0" + min : min;
        hour = hour.length < 2 ? "0" + hour : hour;
        let daysText = days > 0 ? days + "." : "";
        return daysText + hour + ":" + min + ":" + sec;
    }
}


export class ApplicationInsightsMetrics implements IMetrics, IRequestTrackerFactory {
    private static instance: ApplicationInsightsMetrics;

    startSpan(ctx: IRequestContext, id: TrackerInfo, name: string, kind: SpanKind, action: string): IRequestTracker {
        return new Tracker(ctx, id, name, kind, action);
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
     /
    increment(metric: string, customTags?: any, delta: number = 1) {
    }

    /**
     * Track a timing value
     * @param metric Metric name
     * @param duration duration is ms
     * @param customTags Object containing contextuel key value tags
     /
    timing(metric: string, duration: number, customTags?: any) {
    }
}
*/