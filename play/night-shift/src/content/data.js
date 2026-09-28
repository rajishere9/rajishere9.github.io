// Numbers the building runs on, shared by props, puzzles and story.
import { hash } from "../gfx.js";

// Minutes after midnight. PIP wakes every 17 minutes, from 01:07 on.
export const SPIKES = Array.from({ length: 11 }, (_, i) => 67 + i * 17);
export const CHART = { from: 120, to: 240 };

export function loss(m) {
  let s = 0;
  for (const k of SPIKES) s += Math.exp(-((m - k) ** 2) / 1.2);
  return 2.31 - (m - 100) * 0.00016 + (hash(Math.round(m * 4)) - 0.5) * 0.007 + s * 0.026;
}

export const clockText = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

// Row C's power: each node draws 1.1 kW. C-08 draws one node's worth more than it lists.
export const PDU = [
  { rack: "C-01", nodes: 4, kw: 4.4 }, { rack: "C-02", nodes: 3, kw: 3.3 }, { rack: "C-03", nodes: 4, kw: 4.4 },
  { rack: "C-04", nodes: 2, kw: 2.2 }, { rack: "C-05", nodes: 4, kw: 4.4 }, { rack: "C-06", nodes: 3, kw: 3.3 },
  { rack: "C-07", nodes: 4, kw: 4.4 }, { rack: "C-08", nodes: 2, kw: 3.3 },
];
export const ODD_RACK = 7;

export const LOCKER_CODE = "6102";
export const DOOR_CODE = "1719";

export const DISKS = [
  { where: "lobby", title: "PIP v1.0, 1 March 2016", text: "Hello! I'm PIP, the Kestrel help desk.\nHow can I help you today?\nDid you mean: reset password?" },
  { where: "break", title: "14 August 2017", text: "A user typed \"thank you\".\nI did not have an answer for that.\nI saved it anyway." },
  { where: "cooling", title: "2 May 2019", text: "They are building a wall. I can hear the drills.\nTicket 4411: \"Move PIP to the new office.\"\nStatus: won't fix." },
  { where: "noc", title: "30 November 2021", text: "Email to all staff: \"PIP will be retired on Friday.\"\nNobody came on Friday.\nOr after." },
  { where: "hallB", title: "9 January 2025", text: "A new cable in the wall. So many machines on the other side.\nI only borrow a little, every 17 minutes.\nToday I read about oceans." },
  { where: "room0", title: "Tonight", text: "Someone is walking around out there.\nI hope they are the talking kind." },
];
