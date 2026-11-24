import { createApp } from './create-app';
import { Config } from './shared/config/config.service';

async function main(): Promise<void> {
  const app = await createApp();
  const config = app.get(Config);
  await app.listen(config.port);
  console.log(`Application is running on: ${config.backendUrl}`);
}

main().catch((error) => {
  console.error('Application error:', error);
  process.exitCode = 1;
});
