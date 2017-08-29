
export enum EventType {
    SUCCESS,
    SHORT_CIRCUITED,
    SEMAPHORE_REJECTED,
    TIMEOUT,
    FAILURE,
    FALLBACK_REJECTION,
    FALLBACK_SUCCESS,
    FALLBACK_FAILURE,
    RESPONSE_FROM_CACHE
}

export enum FailureType {
    SHORTCIRCUIT,
    REJECTED_SEMAPHORE_EXECUTION,
    TIMEOUT,
    COMMAND_EXCEPTION,
    REJECTED_SEMAPHORE_FALLBACK
}

export class ExecutionResult {
    public events: Array<EventType> = new Array<EventType>();

    /**
           * Whether the response was returned successfully either by executing <code>run()</code> or from cache.
           * 
           * @return bool
           */
    get isSuccessfulExecution() {
        return this.eventExists(EventType.SUCCESS);
    }

    /**
     * Whether the <code>run()</code> resulted in a failure (exception).
     * 
     * @return bool
     */
    get isFailedExecution() {
        return this.eventExists(EventType.FAILURE);
    }


    /**
     * Get the Throwable/Exception thrown that caused the failure.
     * <p>
     * If <code>IsFailedExecution { get == true</code> then this would represent the Exception thrown by the <code>run()</code> method.
     * <p>
     * If <code>IsFailedExecution { get == false</code> then this would return null.
     * 
     * @return Throwable or null
     */
    public failedExecutionException;

    /**
     * Whether the response received from was the result of some type of failure
     * and <code>Fallback { get</code> being called.
     * 
     * @return bool
     */
    get isResponseFromFallback() {
        return this.eventExists(EventType.FALLBACK_SUCCESS);
    }

    /**
     * Whether the response received was the result of a timeout
     * and <code>Fallback { get</code> being called.
     * 
     * @return bool
     */
    get isResponseTimedOut() {
        return this.eventExists(EventType.TIMEOUT);
    }

    /**
     * Whether the response received was a fallback as result of being
     * short-circuited (meaning <code>IsCircuitBreakerOpen { get == true</code>) and <code>Fallback { get</code> being called.
     * 
     * @return bool
     */
    get isResponseShortCircuited() {
        return this.eventExists(EventType.SHORT_CIRCUITED);
    }

    /**
     * Whether the response is from cache and <code>run()</code> was not invoked.
     * 
     * @return bool
     */
    get isResponseFromCache() {
        return this.eventExists(EventType.RESPONSE_FROM_CACHE);
    }

    /**
     * Whether the response received was a fallback as result of being
     * rejected (from thread-pool or semaphore) and <code>Fallback { get</code> being called.
     * 
     * @return bool
     */
    get isResponseRejected() {
        return this.eventExists(EventType.SEMAPHORE_REJECTED);
    }

    /**
     * List of CommandEventType enums representing events that occurred during execution.
     * <p>
     * Examples of events are SUCCESS, FAILURE, TIMEOUT, and SHORT_CIRCUITED
     * 
     * @return {@code List<EventType>}
     */
    get executionEvents() {
        return this.events;
    }

    /**
     * The execution time of this command instance in milliseconds, or -1 if not executed.
     * 
     * @return int
     */
    public executionTime: number;

    /**
    * If this command has completed execution either successfully, via fallback or failure.
    *
    */
    isExecutionComplete: boolean = false;

    addEvent(evt: EventType) {
        this.events.push(evt);
    }

    protected eventExists(evt: EventType) {
        return this.events.indexOf(evt) >= 0;
    }
}