import { CommandMetricsFactory } from "../metrics/commandMetricsFactory";
import RollingNumberEvent from "../metrics/hystrix/rollingNumberEvent";
import { HystrixCommandMetrics } from '../metrics/hystrix/hystrixCommandMetrics';
import {Observable} from 'rxjs';
import ActualTime from "../../utils/actualTime";
import { CircuitBreakerFactory } from "../circuitBreaker";
import { Service } from "../../globals/system";
import { IRequestContext } from '../../pipeline/common';
import http = require('http');

export class HystrixSSEStream {
    static getHandler() {
        return (request: http.IncomingMessage, response: http.ServerResponse) => {
            response.setHeader('Content-Type', 'text/event-stream;charset=UTF-8');
            response.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
            response.setHeader('Pragma', 'no-cache');
            //     System.log.info(null, () => "get hystrix.stream");

            let subscription = HystrixSSEStream.toObservable().subscribe(
                function onNext(sseData) {
                    response.write('data: ' + sseData + '\n\n');
                },
                function onError(error) {
                    Service.log.error(null, error, () => "hystrixstream: error");
                },
                function onComplete() {
                    //     System.log.info(null, () => "end hystrix.stream");
                    return response.end();
                }
            );
            request.on("close", () => {
                //    System.log.info(null, () => "close hystrix.stream");
                subscription.unsubscribe();
            });
        };    
    }
    
    static toObservable(delay=2000) {
        let observableMetrics = Observable
            .interval(delay)
            .flatMap(() => {
                return Observable.from( Array.from(CommandMetricsFactory.getAllMetrics()));
            })
            .map((metrics: any) => {
                return HystrixSSEStream.toCommandJson(metrics);
            });

        return observableMetrics;
    }

    static toCommandJson(metrics: HystrixCommandMetrics) {
        let json:any = {};
        json.type = "HystrixCommand";
        json.name =  metrics.commandName;
        json.group = Service.fullServiceName;
        json.currentTime = ActualTime.getCurrentTime();

        let circuitBreaker = CircuitBreakerFactory.get(metrics.commandName);
        json.isCircuitBreakerOpen = circuitBreaker.isOpen();

        let {totalCount, errorCount, errorPercentage} = metrics.getHealthCounts();
        json.errorPercentage = errorPercentage;
        json.errorCount = errorCount;
        json.requestCount = totalCount;

        json.rollingCountFailure = metrics.getRollingCount(RollingNumberEvent.FAILURE);
        json.rollingCountTimeout = metrics.getRollingCount(RollingNumberEvent.TIMEOUT);
        json.rollingCountSuccess = metrics.getRollingCount(RollingNumberEvent.SUCCESS);
        json.rollingCountShortCircuited = metrics.getRollingCount(RollingNumberEvent.SHORT_CIRCUITED);
        json.rollingCountBadRequests = metrics.getRollingCount(RollingNumberEvent.BAD_REQUEST);
        json.rollingCountCollapsedRequests = 0;
        json.rollingCountExceptionsThrown = metrics.getRollingCount(RollingNumberEvent.EXCEPTION_THROWN);
        json.rollingCountFallbackFailure = metrics.getRollingCount(RollingNumberEvent.FALLBACK_FAILURE);
        json.rollingCountFallbackRejection = metrics.getRollingCount(RollingNumberEvent.FALLBACK_REJECTION);
        json.rollingCountFallbackSuccess = metrics.getRollingCount(RollingNumberEvent.FALLBACK_SUCCESS);
        json.rollingCountResponsesFromCache = metrics.getRollingCount(RollingNumberEvent.RESPONSE_FROM_CACHE);
        json.rollingCountSemaphoreRejected = metrics.getRollingCount(RollingNumberEvent.REJECTED);
        json.rollingCountThreadPoolRejected = 0;
        json.currentConcurrentExecutionCount = metrics.getCurrentExecutionCount();

        json.latencyExecute_mean = metrics.getExecutionTime("mean") || 0;
        json.latencyExecute = {};
        json.latencyExecute["0"] = metrics.getExecutionTime(0) || 0;
        json.latencyExecute["25"] = metrics.getExecutionTime(25) || 0;
        json.latencyExecute["50"] = metrics.getExecutionTime(50) || 0;
        json.latencyExecute["75"] = metrics.getExecutionTime(75) || 0;
        json.latencyExecute["90"] = metrics.getExecutionTime(90) || 0;
        json.latencyExecute["95"] = metrics.getExecutionTime(95) || 0;
        json.latencyExecute["99"] = metrics.getExecutionTime(99) || 0;
        json.latencyExecute["99.5"] = metrics.getExecutionTime(99.5) || 0;
        json.latencyExecute["100"] = metrics.getExecutionTime(100) || 0;

        json.latencyTotal_mean = metrics.getExecutionTime("mean") || 0;
        json.latencyTotal = {};
        json.latencyTotal["0"] = metrics.getExecutionTime(0) || 0;
        json.latencyTotal["25"] = metrics.getExecutionTime(25) || 0;
        json.latencyTotal["50"] = metrics.getExecutionTime(50) || 0;
        json.latencyTotal["75"] = metrics.getExecutionTime(75) || 0;
        json.latencyTotal["90"] = metrics.getExecutionTime(90) || 0;
        json.latencyTotal["95"] = metrics.getExecutionTime(95) || 0;
        json.latencyTotal["99"] = metrics.getExecutionTime(99) || 0;
        json.latencyTotal["99.5"] = metrics.getExecutionTime(99.5) || 0;
        json.latencyTotal["100"] = metrics.getExecutionTime(100) || 0;

        json.propertyValue_circuitBreakerRequestVolumeThreshold = circuitBreaker.properties.circuitBreakerRequestVolumeThreshold.value;
        json.propertyValue_circuitBreakerSleepWindowInMilliseconds = circuitBreaker.properties.circuitBreakerSleepWindowInMilliseconds.value;
        json.propertyValue_circuitBreakerErrorThresholdPercentage = circuitBreaker.properties.circuitBreakerErrorThresholdPercentage.value;
        json.propertyValue_circuitBreakerForceOpen = false;
        json.propertyValue_circuitBreakerForceClosed = false;
        json.propertyValue_circuitBreakerEnabled = true;

        json.propertyValue_metricsRollingStatisticalWindowInMilliseconds = metrics.metricsRollingStatisticalWindowInMilliseconds;

        //json.propertyValue_executionIsolationStrategy = "THREAD";
        json.propertyValue_executionIsolationStrategy = 'unknown';
        json.propertyValue_executionIsolationThreadTimeoutInMilliseconds = metrics.properties.executionTimeoutInMilliseconds.value;
        json.propertyValue_executionIsolationThreadInterruptOnTimeout = 0;
        json.propertyValue_executionIsolationThreadPoolKeyOverride = false;
        json.propertyValue_executionIsolationSemaphoreMaxConcurrentRequests = metrics.properties.executionIsolationSemaphoreMaxConcurrentRequests.value;
        json.propertyValue_fallbackIsolationSemaphoreMaxConcurrentRequests = metrics.properties.fallbackIsolationSemaphoreMaxConcurrentRequests.value;


        json.propertyValue_requestCacheEnabled = false;
        json.propertyValue_requestLogEnabled = true;

        json.reportingHosts = 1;

        return JSON.stringify(json);
    }
}
