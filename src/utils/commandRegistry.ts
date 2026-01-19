import { MyContext } from "../context.js";

export interface CommandMetadata {
    name: string;
    description: string;
    handler: (ctx: MyContext) => Promise<any>;
    adminOnly?: boolean;
}

const commands: CommandMetadata[] = [];

export const registerCommand = (metadata: CommandMetadata) => {
    commands.push(metadata);
};

export const getCommands = () => commands;
