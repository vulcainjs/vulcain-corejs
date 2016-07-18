import ActualTime from "../../utils/actualTime";
import {CommandMetricsFactory, CommandMetrics} from "../metrics/commandMetrics";
import {CommandProperties} from "./commandProperties";

export interface CircuitBreaker {
    allowRequest(): boolean;
    markSuccess(): void;
    isOpen(): boolean;
    properties: CommandProperties;
}

class NoOpCircuitBreaker implements CircuitBreaker {
    constructor(private commandKey: string, public properties: CommandProperties) { }

    allowRequest() { return true; }
    markSuccess() { }
    isOpen() { return false;}
}

class DefaultCircuitBreaker implements CircuitBreaker {
    private circuitOpen: boolean;
    private circuitOpenedOrLastTestedTime;
    private circuitBreakerRequestVolumeThresholdValue: number;

    constructor(private commandKey:string, public properties: CommandProperties)
    {
        this.circuitOpen = false;
        this.circuitOpenedOrLastTestedTime = ActualTime.getCurrentTime();
    }

    allowRequest() {
        if (this.properties.circuitBreakerForceOpen.value) {
            return false;
        }

        if (this.properties.circuitBreakerForceClosed.value) {
            this.isOpen();
            return true;
        }
        return !this.isOpen() || this.allowSingleTest();
    }

    get metrics() {
        return CommandMetricsFactory.getOrCreate(this.properties);
    }

    allowSingleTest() {
        if (this.circuitOpen && ActualTime.getCurrentTime() > this.circuitOpenedOrLastTestedTime + this.properties.circuitBreakerSleepWindowInMilliseconds.value) {
            this.circuitOpenedOrLastTestedTime = ActualTime.getCurrentTime();
            return true;
        } else {
            return false;
        }
    }

    isOpen() {
        if (this.circuitOpen) {
            return true;
        }

        let {totalCount = 0, errorCount , errorPercentage} = this.metrics.getHealthCounts();
        if (totalCount < this.properties.circuitBreakerRequestVolumeThreshold.value) {
            return false;
        }

        if (errorPercentage > this.properties.circuitBreakerErrorThresholdPercentage.value) {
            this.circuitOpen = true;
            this.circuitOpenedOrLastTestedTime = ActualTime.getCurrentTime();
            return true;
        } else {
            return false;
        }
    }

    markSuccess() {
        if (this.circuitOpen) {
            this.circuitOpen = false;
            this.metrics.reset();
        }
    }
}

const circuitBreakersByCommand = new Map();

export class CircuitBreakerFactory {

    static getOrCreate(properties:CommandProperties) {

        let previouslyCached = circuitBreakersByCommand.get(properties.commandName);
        if (previouslyCached) {
            return previouslyCached
        }

        let circuitBreaker = properties.circuitBreakerEnabled ?
            new DefaultCircuitBreaker(properties.commandName, properties) :
            new NoOpCircuitBreaker(properties.commandName, properties);

        circuitBreakersByCommand.set(properties.commandName, circuitBreaker);
        return circuitBreakersByCommand.get(properties.commandName);

    }

    static get(commandName: string): CircuitBreaker {
        return circuitBreakersByCommand.get(commandName);
    }

    static getCache() {
        return circuitBreakersByCommand;
    }

    static resetCache() {
        circuitBreakersByCommand.clear();
    }
}