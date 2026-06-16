declare module "electron" {
    export const shell: {
        openPath(path: string): Promise<string>;
    };
}
