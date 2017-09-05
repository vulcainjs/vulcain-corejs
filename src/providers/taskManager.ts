import { AsyncTaskData } from "../pipeline/handlers/actions";

export interface ITaskManager {
    registerTaskAsync(task: AsyncTaskData): Promise<void>;
    updateTaskAsync(task: AsyncTaskData): Promise<void>;
    getTaskAsync(taskId: string): Promise<AsyncTaskData>;
    getAllTasksAsync(query?: any): Promise<AsyncTaskData[]>;
}