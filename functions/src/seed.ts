import { initializeApp } from 'firebase-admin/app';
import { getFunctions } from 'firebase-admin/functions';

initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'radio-osceia-dev' });

async function main() {
  const functions = getFunctions();
  const callable = functions.httpsCallable('bootstrapSeedData');
  await callable({});
  console.log('Seed executado via bootstrapSeedData.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
