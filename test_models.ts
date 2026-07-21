import { getProposalModelConfig } from './server/lib/proposalModels';

async function main() {
  const models = await getProposalModelConfig();
  console.log("Current models config:", JSON.stringify(models, null, 2));
  console.log("mergeText (text === analysis):", models.text === models.analysis);
}

main().catch(console.error);
