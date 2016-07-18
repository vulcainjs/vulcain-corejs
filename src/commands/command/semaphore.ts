import {CommandProperties} from './commandProperties'

export class Semaphore {
    private currentExecution = 0;
    private currentFallback = 0;
    
    constructor(private maxExecution: number, private maxFallback: number) { }
    
    canExecuteCommand() {
        this.currentExecution++;
        return this.maxExecution === 0 || this.currentExecution <= this.maxExecution;
    }
    
    releaseExecutionCommand() {
        this.currentExecution--;
    }
    
    canExecuteFallback() {
        this.currentFallback++;
        return this.currentFallback === 0 || this.currentExecution <= this.maxFallback;
    }

    releaseFallback() {
        this.currentFallback--;
    }
    
}

export class SemaphoreFactory {
    private static semaphores = new Map<string, Semaphore>();
    
    static getOrCreate(info:CommandProperties) {

        let previouslyCached = SemaphoreFactory.semaphores.get(info.commandName);
        if (previouslyCached) {
            return previouslyCached
        }
        let semaphore = new Semaphore(info.executionIsolationSemaphoreMaxConcurrentRequests.value, info.fallbackIsolationSemaphoreMaxConcurrentRequests.value);
        SemaphoreFactory.semaphores.set(info.commandName, semaphore);
        return semaphore;
    }

    static resetCache() {
        SemaphoreFactory.semaphores.clear();
    }
}