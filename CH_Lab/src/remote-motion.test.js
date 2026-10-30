import test from 'node:test';
import assert from 'node:assert/strict';
import { approachMotionPose, createMotionBuffer, predictMotionPose, pushMotionSample, readMotionBuffer } from './remote-motion.js';

test('interpolates movement between received positions and holds the last one', () => {
  const motion = createMotionBuffer({ x: 0, z: 0, rotation: 0 }, 1000);
  pushMotionSample(motion, { x: 1, z: 2, rotation: 1 }, 1125);
  assert.deepEqual(readMotionBuffer(motion, 1062.5), { x: .5, z: 1, rotation: .5 });
  assert.equal(readMotionBuffer(motion, 1300).x, 1);
});

test('turns through the shortest angle across the wrap point', () => {
  const motion = createMotionBuffer({ x: 0, z: 0, rotation: Math.PI - .1 }, 0);
  pushMotionSample(motion, { x: 1, z: 0, rotation: -Math.PI + .1 }, 100);
  assert.ok(Math.abs(readMotionBuffer(motion, 50).rotation - Math.PI) < .001);
});

test('ignores identical updates and bounds the position history', () => {
  const motion = createMotionBuffer({ x: 0, z: 0, rotation: 0 }, 0);
  pushMotionSample(motion, { x: 0, z: 0, rotation: 0 }, 100);
  assert.equal(motion.length, 1);
  for (let i = 1; i <= 20; i++) pushMotionSample(motion, { x: i, z: 0, rotation: 0 }, i * 100);
  assert.equal(motion.length, 8);
  assert.equal(readMotionBuffer(motion, 3000).x, 20);
});

test('follows the newest pose without buffering while preserving short turns', () => {
  const current = { x: 0, z: 0, rotation: Math.PI - .1 };
  const target = { x: 1, z: 0, rotation: -Math.PI + .1 };
  const first = approachMotionPose(current, target, 1 / 60);
  assert.ok(first.x > 0 && first.x < 1);
  assert.ok(first.rotation > current.rotation);
  let pose = first;
  for (let frame = 0; frame < 30; frame++) pose = approachMotionPose(pose, target, 1 / 60);
  assert.ok(Math.abs(pose.x - 1) < .002);
  assert.equal(approachMotionPose(pose, target, 1 / 60), target);
});

test('predicts short linear movement and caps the prediction window', () => {
  const motion = createMotionBuffer({ x: 1, z: 2, rotation: .5, vx: 2, vz: -1 }, 1000);
  assert.deepEqual(predictMotionPose(motion, 1050), { x: 1.1, z: 1.95, rotation: .5 });
  const capped = predictMotionPose(motion, 1300);
  assert.ok(Math.abs(capped.x - 1.28) < 1e-9);
  assert.ok(Math.abs(capped.z - 1.86) < 1e-9);
});
