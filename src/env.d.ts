// <reference types="node" />

namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    DISCORD_CLIENT_ID: string;
    DISCORD_API_TOKEN: string;
    STEAM_API_TOKEN: string;
    MONGO_DB_URL: string;
  }
}
