import { machuPicchuWorld } from './machuPicchu.js';
import { stonehengeWorld } from './stonehenge.js';
import { pyramidsWorld } from './pyramids.js';
import { angkorWatWorld } from './angkorWat.js';
import { moonWorld } from './moon.js';

// Add any new world plugin here in 1 line!
export const WORLDS = [
  machuPicchuWorld,
  stonehengeWorld,
  pyramidsWorld,
  angkorWatWorld,
  moonWorld
];

export function getWorldById(id) {
  return WORLDS.find((w) => w.id === id) || WORLDS[0];
}