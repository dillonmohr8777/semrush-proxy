#!/usr/bin/env node

import { Command } from 'commander';
import config from './config.js';
import { initVault } from './vault/init.js';
import VaultWriter from './vault/writer.js';

// Helper to resolve both named and default exports from dynamic imports
function resolve(mod, name) {
  return mod[name] || mod.default;
}

const program = new Command();

program
  .name('revenue-os')
  .description('Revenue Leadership Operating System — Sales Pipeline Intelligence Platform')
  .version('1.0.0');

// Initialize vault
program
  .command('init-vault')
  .description('Initialize a new Revenue OS Obsidian vault')
  .argument('[path]', 'Path to create the vault', config.vault.path)
  .action(async (vaultPath) => {
    await initVault(vaultPath);
  });

// Sync HubSpot data
program
  .command('sync')
  .description('Sync all data from HubSpot into the vault')
  .option('--deals', 'Sync deals only')
  .option('--pipeline', 'Sync pipeline snapshot only')
  .action(async (options) => {
    const HubSpotClient = resolve(await import('./integrations/hubspot.js'), 'HubSpotClient');
    const HubSpotSync = resolve(await import('./integrations/hubspot-sync.js'), 'HubSpotSync');

    const client = new HubSpotClient();
    const sync = new HubSpotSync(client, new VaultWriter());

    if (options.deals) {
      console.log('Syncing deals...');
      await sync.syncDeals();
    } else if (options.pipeline) {
      console.log('Syncing pipeline snapshot...');
      await sync.syncPipelineSnapshot();
    } else {
      console.log('Running full sync...');
      await sync.fullSync();
    }
    console.log('Sync complete.');
  });

// Daily brief
program
  .command('daily-brief')
  .description('Generate and send the daily executive brief')
  .option('--no-email', 'Skip sending email, only write to vault')
  .action(async (options) => {
    const HubSpotClient = resolve(await import('./integrations/hubspot.js'), 'HubSpotClient');
    const AgentOrchestrator = resolve(await import('./agents/orchestrator.js'), 'AgentOrchestrator');
    const AlertEngine = resolve(await import('./notifications/alerts.js'), 'AlertEngine');

    const client = new HubSpotClient();
    const orchestrator = new AgentOrchestrator();
    const alerts = new AlertEngine();

    console.log('Running daily analysis...');
    const results = await orchestrator.runDailyAnalysis(client);

    console.log('Generating daily brief...');
    await alerts.processDailyBrief(results, { sendEmail: options.email });

    console.log('Daily brief complete.');
  });

// Pipeline review
program
  .command('pipeline-review')
  .description('Run a pipeline risk analysis')
  .action(async () => {
    const HubSpotClient = resolve(await import('./integrations/hubspot.js'), 'HubSpotClient');
    const AgentOrchestrator = resolve(await import('./agents/orchestrator.js'), 'AgentOrchestrator');

    const client = new HubSpotClient();
    const orchestrator = new AgentOrchestrator();

    console.log('Analyzing pipeline...');
    const results = await orchestrator.runDailyAnalysis(client);

    const writer = new VaultWriter();
    await writer.writePipelineReview(results.pipelineRisk);

    console.log('\nPipeline Risk Summary:');
    console.log(`  Total at risk: ${results.pipelineRisk.summary?.totalAtRisk || 0}`);
    console.log(`  Critical: ${results.pipelineRisk.summary?.criticalCount || 0}`);
    console.log(`  High: ${results.pipelineRisk.summary?.highCount || 0}`);
    console.log('\nRisk flags written to vault.');
  });

// Forecast
program
  .command('forecast')
  .description('Run forecast confidence analysis')
  .action(async () => {
    const HubSpotClient = resolve(await import('./integrations/hubspot.js'), 'HubSpotClient');
    const AgentOrchestrator = resolve(await import('./agents/orchestrator.js'), 'AgentOrchestrator');

    const client = new HubSpotClient();
    const orchestrator = new AgentOrchestrator();

    console.log('Analyzing forecast...');
    const results = await orchestrator.runDailyAnalysis(client);
    const forecast = results.forecastConfidence;

    const writer = new VaultWriter();
    await writer.writeForecastNote(forecast);

    console.log('\nForecast Confidence:');
    console.log(`  Score: ${forecast.confidenceScore}/100`);
    console.log(`  Coverage: ${forecast.coverageRatio}x`);
    console.log(`  Commit: $${(forecast.commitTotal || 0).toLocaleString()}`);
    console.log(`  Best Case: $${(forecast.bestCaseTotal || 0).toLocaleString()}`);
    if (forecast.forecastDrift?.warning) {
      console.log(`  DRIFT WARNING: ${forecast.forecastDrift.warning}`);
    }
    console.log('\nForecast note written to vault.');
  });

// Deal analysis
program
  .command('deal')
  .description('Analyze a specific deal')
  .argument('<dealId>', 'HubSpot deal ID')
  .action(async (dealId) => {
    const HubSpotClient = resolve(await import('./integrations/hubspot.js'), 'HubSpotClient');
    const AgentOrchestrator = resolve(await import('./agents/orchestrator.js'), 'AgentOrchestrator');

    const client = new HubSpotClient();
    const orchestrator = new AgentOrchestrator();

    console.log(`Analyzing deal ${dealId}...`);
    const result = await orchestrator.analyzeDeal(client, dealId);

    const writer = new VaultWriter();
    await writer.writeDealNote(
      { dealId, name: result.dealName, ...result },
      result
    );

    console.log('\nDeal Intelligence:');
    console.log(`  ${result.summary}`);
    console.log(`  Momentum: ${result.momentumScore}/100`);
    if (result.blockers?.length) {
      console.log('  Blockers:');
      result.blockers.forEach(b => console.log(`    - ${b}`));
    }
    console.log('\nDeal note written to vault.');
  });

// Coaching
program
  .command('coaching')
  .description('Run rep coaching analysis')
  .argument('[ownerId]', 'HubSpot owner ID (omit for all reps)')
  .action(async (ownerId) => {
    const HubSpotClient = resolve(await import('./integrations/hubspot.js'), 'HubSpotClient');
    const AgentOrchestrator = resolve(await import('./agents/orchestrator.js'), 'AgentOrchestrator');

    const client = new HubSpotClient();
    const orchestrator = new AgentOrchestrator();
    const writer = new VaultWriter();

    if (ownerId) {
      console.log(`Analyzing rep ${ownerId}...`);
      const result = await orchestrator.runCoachingAnalysis(client, ownerId);
      await writer.writeCoachingNote(result.repName || ownerId, result);
      console.log('\nScorecard:');
      Object.entries(result.scorecard || {}).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });
    } else {
      console.log('Analyzing all reps...');
      const owners = await client.getOwners();
      for (const owner of owners) {
        const result = await orchestrator.runCoachingAnalysis(client, owner.id);
        await writer.writeCoachingNote(owner.name || owner.id, result);
        console.log(`  ${owner.name}: done`);
      }
    }
    console.log('\nCoaching notes written to vault.');
  });

// Process meeting notes
program
  .command('meeting')
  .description('Process meeting notes')
  .argument('<type>', 'Meeting type: pipeline_review, rep_1on1, forecast_call, leadership, team')
  .option('-f, --file <path>', 'Path to raw notes file')
  .option('-t, --title <title>', 'Meeting title')
  .action(async (type, options) => {
    const AgentOrchestrator = resolve(await import('./agents/orchestrator.js'), 'AgentOrchestrator');
    const fs = await import('fs/promises');

    let rawNotes = '';
    if (options.file) {
      rawNotes = await fs.readFile(options.file, 'utf-8');
    } else {
      console.log('Reading notes from stdin... (Ctrl+D when done)');
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      rawNotes = Buffer.concat(chunks).toString('utf-8');
    }

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.processMeeting(rawNotes, type);

    const writer = new VaultWriter();
    await writer.writeMeetingNote({
      ...result,
      meetingType: type,
      title: options.title || type,
    });

    console.log('\nMeeting processed:');
    console.log(`  Decisions: ${result.decisions?.length || 0}`);
    console.log(`  Action items: ${result.actionItems?.length || 0}`);
    console.log('\nMeeting note written to vault.');
  });

// Alerts check
program
  .command('alerts')
  .description('Check for and route active alerts')
  .action(async () => {
    const HubSpotClient = resolve(await import('./integrations/hubspot.js'), 'HubSpotClient');
    const AgentOrchestrator = resolve(await import('./agents/orchestrator.js'), 'AgentOrchestrator');
    const AlertEngine = resolve(await import('./notifications/alerts.js'), 'AlertEngine');

    const client = new HubSpotClient();
    const orchestrator = new AgentOrchestrator();
    const alerts = new AlertEngine();

    console.log('Running full analysis for alerts...');
    const results = await orchestrator.runFullSuite(client);

    console.log('Processing alerts...');
    const alertsSent = await alerts.processAllAlerts(results, client);

    console.log(`\nAlerts processed: ${alertsSent}`);
  });

// Setup custom properties in HubSpot
program
  .command('setup-hubspot')
  .description('Create custom properties in HubSpot')
  .action(async () => {
    const HubSpotClient = resolve(await import('./integrations/hubspot.js'), 'HubSpotClient');
    const client = new HubSpotClient();

    console.log('Creating custom HubSpot properties...');
    await client.createCustomProperties();
    console.log('Custom properties created successfully.');
  });

// Run scheduler
program
  .command('run')
  .description('Start the Revenue OS scheduler (runs continuously)')
  .action(async () => {
    const { startScheduler } = await import('./scheduler.js');
    console.log('Starting Revenue OS scheduler...');
    console.log(`  Daily brief: ${config.schedules.dailyBrief}`);
    console.log(`  Weekly forecast: ${config.schedules.weeklyForecast}`);
    console.log(`  Pipeline sync: ${config.schedules.pipelineSync}`);
    await startScheduler();
  });

program.parse();
