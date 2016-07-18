export default class ActualTime {

    // For test only
    static enableVirtualTimer() {
        ActualTime._currentTime = 1;
        ActualTime.getCurrentTime = () => ActualTime._currentTime;
    }

    static fastForwardActualTime(ms: number) {
        ActualTime._currentTime += ms;
    }

    static restore() {
        ActualTime.getCurrentTime = () => Date.now();    
    }
    
    private static _currentTime = 1;
    // End test only

    // Return current time in ms
    static getCurrentTime() {
        return Date.now();
    }
}

