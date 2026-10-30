export function createMotionBuffer(pose, at) {
  return [{
    x: pose.x, z: pose.z, rotation: pose.rotation,
    vx: Number.isFinite(pose.vx) ? pose.vx : 0,
    vz: Number.isFinite(pose.vz) ? pose.vz : 0,
    at,
  }];
}

export function pushMotionSample(buffer, pose, at) {
  const last = buffer.at(-1);
  if (last && Math.hypot(pose.x - last.x, pose.z - last.z) < .001 &&
      Math.abs(Math.atan2(Math.sin(pose.rotation - last.rotation), Math.cos(pose.rotation - last.rotation))) < .001 &&
      Math.hypot((pose.vx ?? 0) - last.vx, (pose.vz ?? 0) - last.vz) < .001) return;
  buffer.push({
    x: pose.x, z: pose.z, rotation: pose.rotation,
    vx: Number.isFinite(pose.vx) ? pose.vx : 0,
    vz: Number.isFinite(pose.vz) ? pose.vz : 0,
    at: Math.max(at, last.at + 1),
  });
  if (buffer.length > 8) buffer.shift();
}

export function predictMotionPose(buffer, at, maxPredictionMs = 140) {
  const latest = buffer.at(-1);
  const seconds = Math.max(0, Math.min(maxPredictionMs, at - latest.at)) / 1000;
  return {
    x: latest.x + latest.vx * seconds,
    z: latest.z + latest.vz * seconds,
    rotation: latest.rotation,
  };
}

export function readMotionBuffer(buffer, at) {
  while (buffer.length > 1 && buffer[1].at <= at) buffer.shift();
  const first = buffer[0];
  const next = buffer[1];
  if (!next || at <= first.at) return first;
  const progress = (at - first.at) / (next.at - first.at);
  const turn = Math.atan2(Math.sin(next.rotation - first.rotation), Math.cos(next.rotation - first.rotation));
  return {
    x: first.x + (next.x - first.x) * progress,
    z: first.z + (next.z - first.z) * progress,
    rotation: first.rotation + turn * progress,
  };
}

export function approachMotionPose(current, target, dt) {
  const progress = 1 - Math.exp(-Math.max(0, dt) * 28);
  const turn = Math.atan2(Math.sin(target.rotation - current.rotation), Math.cos(target.rotation - current.rotation));
  const distance = Math.hypot(target.x - current.x, target.z - current.z);
  if (distance < .002 && Math.abs(turn) < .004) return target;
  return {
    x: current.x + (target.x - current.x) * progress,
    z: current.z + (target.z - current.z) * progress,
    rotation: current.rotation + turn * progress,
  };
}
