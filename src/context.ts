import { Context, SessionFlavor } from "grammy";

// Define the shape of our Session
export interface SessionData {
    // Add session fields here if needed
}

// Define the custom context type
export type MyContext = Context & SessionFlavor<SessionData>;
