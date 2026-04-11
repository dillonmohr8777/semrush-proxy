import { CronJob } from 'cron';
import config from './config.js';
import { HubSpotClient } from './integrations/hubspot.js';
import { HubSpotSync } from './integrations/hubspot-sync.js';
import VaultWriter from './vault/writer.js';

export async function startScheduler() {
  const client = new HubSpotClient();
  const writer = new VaultWriter();
  const sync = new HubSpotSync(client, writer);

  // Daily executive brief — weekdays at configured time
  const dailyBrief = new CronJob(config.schedules.dailyBrief, async () => {
    console.log(`[${new Date().toISOString()}] Running daily brief...`);
    try {
      const { AgentOrchestrator } = await import('./agents/orchestrator.js');
      const { AlertEngine } = await import('./notifications/alerts.js');

      const orchestrator = new AgentOrchestrator();
      const alerts = new AlertEngine(writer);

      const results = await orchestrator.runDailyAnalysis(client);
      await alerts.processDailyBrief(results, { sendEmail: true });
      console.log(`[${new Date().toISOString()}] Daily brief complete.`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Daily brief failed:`, err.message);
    }
  });

  // Weekly forecast memo — Monday mornings
  const weeklyForecast = new CronJob(config.schedules.weeklyForecast, async () => {
    console.log(`[${new Date().toISOString()}] Running weekly forecast...`);
    try {
      const { AgentOrchestrator } = await import('./agents/orchestrator.js');
      const { AlertEngine } = await import('./notifications/alerts.js');

      const orchestrator = new AgentOrchestrator();
      const alerts = new AlertEngine(writer);

      const results = await orchestrator.runFullSuite(client);
      await alerts.processAllAlerts(results, client);
      await writer.writeForecastNote(results.forecastConfidence);
      console.log(`[${new Date().toISOString()}] Weekly forecast complete.`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Weekly forecast failed:`, err.message);
    }
  });

  // Pipeline sync — every 4 hours
  const pipelineSync = new CronJob(config.schedules.pipelineSync, async () => {
    console.log(`[${new Date().toISOString()}] Running pipeline sync...`);
    try {
      await sync.fullSync();
      console.log(`[${new Date().toISOString()}] Pipeline sync complete.`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Pipeline sync failed:`, err.message);
    }
  });

  dailyBrief.start();
  weeklyForecast.start();
  pipelineSync.start();

  console.log('Revenue OS scheduler started.');
  console.log('Press Ctrl+C to stop.');

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nShutting down Revenue OS scheduler...');
    dailyBrief.stop();
    weeklyForecast.stop();
    pipelineSync.stop();
    process.exit(0);
  });

  // Prevent process from exiting
  await new Promise(() => {});
}
