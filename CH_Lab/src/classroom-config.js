export const deskPositions = [
  { x: -5.65, z: -1.8 }, { x: -2.35, z: -1.8 }, { x: 1.05, z: -1.8 },
  { x: -5.65, z: 0.95 }, { x: -2.35, z: 0.95 }, { x: 1.05, z: 0.95 },
  { x: -5.65, z: 3.7 }, { x: -2.35, z: 3.7 }, { x: 1.05, z: 3.7 },
  { x: 4.4, z: 0.95 },
];

// Open floor on the right side of the room, away from desks, the TV shelf,
// plants and the room boundary. Every fresh join starts here.
export const SPAWN_POSITION = Object.freeze({ x: 5.4, z: 3.7, rotation: Math.PI });

export const seatPosition = id => {
  const desk = deskPositions[id];
  return desk ? { x: desk.x, z: desk.z + 0.95 } : null;
};

// The aisle between desk rows is narrow. Moving 0.43 m behind the chair
// places the player in its center instead of inside the next desk collider.
export const standingPosition = id => {
  const seat = seatPosition(id);
  return seat ? { x: seat.x, z: seat.z + 0.43, rotation: Math.PI } : null;
};

export const COURSE_CODE = 'VNR202';
export const TEACHER_NAME = 'GIANGVIENVNR202';
export const EXAM_MINUTES = 15;
export const EXAM_QUESTION_COUNT = 15;
export const ROOM_CAPACITY = 10;
export const BUZZER_GROUP_COUNT = 5;
export const BUZZER_POINTS = 10;
export const BUZZER_SECONDS = 60;
export const BUZZER_HANDICAP_MS = 500;
export const BUZZER_DOUBLE_INDEXES = [4, 9, 14];
