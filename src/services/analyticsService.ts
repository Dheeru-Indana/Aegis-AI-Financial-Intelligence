import {activity,transactions} from "../mocks/data"; import {USE_MOCKS,apiRequest} from "./apiClient";
export async function getMetrics(){return USE_MOCKS?{activity,transactions}:apiRequest("/api/metrics");}
