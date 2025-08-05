export declare const config: {
    env: "development" | "test" | "production";
    port: number;
    apiToken: string;
    cors: {
        origin: string;
        credentials: boolean;
    };
    pagination: {
        defaultPage: number;
        defaultLimit: number;
        maxLimit: number;
    };
};
export declare const isDevelopment: boolean;
export declare const isProduction: boolean;
export declare const isTest: boolean;
//# sourceMappingURL=config.d.ts.map