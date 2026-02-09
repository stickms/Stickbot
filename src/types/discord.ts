import type {
  ChatInputCommandInteraction,
  Collection,
  SlashCommandBuilder
} from 'discord.js';

export type Command = {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export type Event = {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void>;
};

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}
