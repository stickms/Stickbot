// <reference types="node" />

import type { ChatInputCommandInteraction, Collection, SlashCommandBuilder } from 'discord.js';

export type Command = {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export type Event = {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void>;
};

declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
  }
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      DISCORD_CLIENT_ID: string;
      DISCORD_API_TOKEN: string;
      STEAM_API_TOKEN: string;
      DATABASE_URL: string;
    }
  }
}
