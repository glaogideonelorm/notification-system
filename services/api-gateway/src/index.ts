import { buildApp } from "./app";

import { env } from "./config/env";

async function start() {
  const app = await buildApp();

  await app.listen({ port: Number(env.PORT), host: "0.0.0.0" });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
