export const AVATAR_OPTIONS = [
  { id: 'male-classic', name: 'Nam cổ điển', gender: 'male', genderLabel: 'Nam', description: 'Nhân vật đồng phục hiện tại', accent: '#6f9fb0', procedural: true },
  { id: 'agnes-tachyon', name: 'Agnes Tachyon', gender: 'female', genderLabel: 'Nữ', description: 'Model chibi áo blouse', accent: '#9b826f' },
  { id: 'chikawa', name: 'Chikawa', gender: 'other', genderLabel: 'Linh vật', description: 'Nhân vật nhỏ đáng yêu', accent: '#e3a99b' },
  { id: 'megumin', name: 'Megumin & Chomosuke', gender: 'female', genderLabel: 'Nữ', description: 'Pháp sư chibi cùng mèo', accent: '#a75955' },
  { id: 'miku', name: 'Miku Chibi', gender: 'female', genderLabel: 'Nữ', description: 'Ca sĩ tóc xanh chibi', accent: '#53aaa8' },
  { id: 'professor-layton', name: 'Professor Layton', gender: 'male', genderLabel: 'Nam', description: 'Giáo sư đội mũ cao', accent: '#8a664b' },
  { id: 'female-suzuka', name: 'Silence Suzuka', gender: 'female', genderLabel: 'Nữ', description: 'Nhân vật chibi tóc nâu', accent: '#725e50' },
  { id: 'super-creek', name: 'Super Creek', gender: 'female', genderLabel: 'Nữ', description: 'Nhân vật chibi tóc bạc', accent: '#8fa0af' },
];

const avatarById = new Map(AVATAR_OPTIONS.map(option => [option.id, option]));

export function getAvatarOption(id) {
  return avatarById.get(id) || AVATAR_OPTIONS[0];
}

export function normalizeAvatarProfile(gender, avatar) {
  const option = avatarById.get(avatar) || AVATAR_OPTIONS[0];
  return { gender: option.gender, avatar: option.id };
}

export function isValidAvatarProfile(gender, avatar) {
  const option = avatarById.get(avatar);
  return Boolean(option && option.gender === gender);
}
