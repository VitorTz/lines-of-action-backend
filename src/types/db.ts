

export interface DBInfo {
    
    status: string;
    name?: string;
    collections?: string[];
    storageSize?: string;
    totalSize?: string;
    error?: string;

}


export interface MemoryInfo {
    
    rss: string
    heapTotal: string
    heapUsed: string
    external: string

}


export interface DBHealthCheck {

    status: string
    uptime: number
    timestamp: string
    nodeVersion: string
    platform: string
    database: DBInfo
    memory: MemoryInfo

}