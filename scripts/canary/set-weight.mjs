import { currentWeights, log, setCanaryWeight } from './lib.mjs';

const target = process.argv[2];

if (target === undefined) {
  log('weights', currentWeights());
} else {
  const before = currentWeights();
  const after = setCanaryWeight(target);
  log('weights.changed', { before: { stable: before.stable, canary: before.canary }, after });
}
