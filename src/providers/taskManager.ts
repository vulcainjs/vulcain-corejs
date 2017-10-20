import { AsyncTaskData } from "../pipeline/handlers/actions";

export interface ITaskManager {
    registerTask(task: AsyncTaskData): Promise<void>;
    updateTask(task: AsyncTaskData): Promise<void>;
    getTask(taskId: string): Promise<AsyncTaskData>;
    getAllTasks(query?: any): Promise<AsyncTaskData[]>;
}