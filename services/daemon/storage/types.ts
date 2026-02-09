
export interface IStorageProvider {
    /** Initialize connection (auth/handshake) */
    initialize(): Promise<void>;

    /** Read a file from storage */
    readFile(filePath: string): Promise<Buffer | null>;

    /** Write a file to storage */
    writeFile(filePath: string, content: Buffer): Promise<boolean>;

    /** List files in a directory */
    list(dirPath: string): Promise<string[]>;

    /** Check if a file/dir exists */
    exists(path: string): Promise<boolean>;

    /** Create a public shared link (if supported) */
    getPublicUrl?(filePath: string): Promise<string | null>;
}

export interface StorageConfig {
    type: 'posix' | 'webdav';
    webdav?: {
        url: string;
        username?: string;
        password?: string;
    };
    rootPath?: string;
}
