import { machuPicchuWorld } from './machuPicchu.js';
import { stonehengeWorld } from './stonehenge.js';
import { pyramidsWorld } from './pyramids.js';
import { angkorWatWorld } from './angkorWat.js';
import { moonWorld } from './moon.js';
import { tokyoTowerWorld } from './tokyoTower.js';

// Add any new world plugin here in 1 line!
export const WORLDS = [
  machuPicchuWorld,
  stonehengeWorld,
  pyramidsWorld,
  angkorWatWorld,
  moonWorld,
  tokyoTowerWorld
];

export function getWorldById(id) {
  return WORLDS.find((w) => w.id === id) || WORLDS[0];
}
