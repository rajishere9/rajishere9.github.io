// The night, start to finish: scenes, dialogue, objects, hints and endings.
import { T } from "./gfx.js";
import { Actor } from "./content/people.js";
import { DISKS, LOCKER_CODE, DOOR_CODE } from "./content/data.js";
import { Keypad } from "./puzzles/keypad.js";
import { Valves } from "./puzzles/valves.js";
import { LossChart } from "./puzzles/loss.js";
import { Terminal } from "./puzzles/terminal.js";
import { Power } from "./puzzles/pdu.js";
import { Patch } from "./puzzles/patch.js";
import { EndCard } from "./ui.js";
export { DISKS };

export const newState = () => ({ map: "exterior", x: 0, y: 0, dir: "up", flags: {}, disks: [], coins: [], minute: 180, pages: [], unread: 0, played: 0, coffee: 0, wallet: 0 });

// ---- Opening ----
export async function intro(g) {
  g.audio.bed("outside");
  await g.fade(0, 0.8);
  g.toast(g.input.mode === "touch" ? "Use the pad, or tap where you want to go." : "Arrow keys or WASD to walk. Space to talk and use.", 5);
}

async function talkRay(g, ray) {
  const f = g.flags;
  if (f.metRay) return g.say("ray", "Locker 4, break room. Night.");
  await g.say("ray", "You must be the new night tech. Ray. Security. Day side, as of about now.");
  const i = await g.choose(["Nice to meet you.", "Anything I should know?"], "ray", "Ray looks at the rain like it owes him money.");
  if (i === 0) await g.say("ray", "Likewise. Couple of things before I go.");
  await g.say("ray", "The coffee machine's haunted. Don't take it personally.");
  await g.say("ray", "Your badge is in locker 4, in the break room. I've buzzed the front door, so you're fine till then.");
  await g.say("ray", "And if the robot offers to show you something, just say yes. It sulks.");
  await g.say("ray", "Night.");
  f.metRay = true;
  ray.dir = "left";
  await g.walk(ray, 9, 12);
  await g.walk(ray, 0, 13);
  ray.hidden = true;
  await g.wait(0.4);
  await g.page("Welcome to nights. Three jobs: badge in, walk Hall B, and log LARK-7's loss at 04:00. Page me if anything's on fire. Literally on fire. -M");
  g.toast(g.input.mode === "touch" ? "Tap the pager, top right, to see your tasks." : "Press Tab to open your pager.", 4);
}

export async function talkMope(g, m) {
  const f = g.flags;
  if (m) g.faceTo(m, g.player);
  if (!f.mopeMet) {
    f.mopeMet = true;
    await g.say("mope", "Oh! A person! Hello, person. I'm MOP-E, Custodial Unit 3.");
    await g.say("mope", "I mop. I also talk. Nobody asked for the talking, but here we are.");
    const i = await g.choose(["Nice to meet you, MOP-E.", "Where's locker 4?", "Who's Marguerite?"], "mope", "What can I do for you? Besides the floors.");
    if (i === 0) await g.say("mope", "Nice to meet me too! Nobody says that. Ray says \"move\".");
    if (i === 1) await g.say("mope", "Top left, the one at the end. I'd open it for you, but I don't have hands. I have a mop.");
    if (i === 2) await g.say("mope", "The day lead. She pages. She never visits at night. She says the building is \"fine\" at night.");
    return g.say("mope", "If you need me, I'll be around. Mostly around this room. Sometimes around this table.");
  }
  if (f.mopeStay) return g.say("mope", "I'll wait out here. Dust isn't really my department. I know. Ironic.");
  if (f.mopeFollow) return g.say("mope", f.posterDown ? "The keypad! How often it wakes up, then the year it closed. I read the sticker. I can read." : "Hall B, the top wall. The poster by the crates. Lead the way.");
  if (f.sawGap) return startFollow(g, m);
  if (g.state.coffee > 0) return g.say("mope", "Is that coffee? I'm not allowed coffee. Marguerite said. Twice.");
  if (!f.badge) return g.say("mope", "Locker 4 is the one at the end. The code is on the fridge. People put everything on the fridge.");
  if (!f.cooled && f.walked) return g.say("mope", "Row C is hot? I love hot. The floors dry so fast.");
  if (!f.marked) return g.say("mope", "The NOC has the good chairs. I'm not allowed to sit. I roll.");
  if (!f.foundPort) return g.say("mope", "Every 17 minutes the coffee machine says something odd. I thought it was just me. It's never just me.");
  return g.say("mope", "The whiteboard has the whole building on it. Very flat building. Very flat drawing.");
}

async function startFollow(g, m) {
  const f = g.flags;
  await g.say("mope", "Did you say Room 0? Nobody says Room 0.");
  await g.say("mope", "I clean in there on Thursdays. It's Thursday!");
  await g.say("mope", "Well. I clean the door. The door is behind a poster in Hall B. I'm not allowed to touch posters.");
  await g.say("mope", "Follow me. Or I'll follow you. I'm flexible. My mop is flexible.");
  f.mopeFollow = true;
  g.setClock(308);
  g.npcs = g.npcs.filter((n) => n !== m);
  g.placeFollower();
  g.toast("MOP-E is following you.");
}

export const follows = (g) => g.flags.mopeFollow && !g.flags.mopeStay;

export function npcs(g, map) {
  const f = g.flags, out = [];
  if (map === "exterior" && !f.metRay && g.mode === "play") out.push(new Actor(g.frames.ray, 15 * T + 8, 8 * T + 11, "down", { id: "ray", use: talkRay }));
  if (map === "break" && !f.mopeFollow) out.push(new Actor(g.frames.mope, 9 * T + 8, 4 * T + 11, "down", { id: "mope", use: talkMope, speed: 34, wander: true, home: [9, 4], glowR: 12, glowC: "#3a2c10" }));
  if (map === "hallB" && f.mopeStay && !f.ending) out.push(new Actor(g.frames.mope, 19 * T + 8, 3 * T + 11, "down", { id: "mope", use: talkMope, glowR: 12, glowC: "#3a2c10" }));
  if (map === "lobby" && f.rayBack) out.push(new Actor(g.frames.ray, 7 * T + 8, 9 * T + 11, "up", { id: "ray", use: (g) => g.say("ray", "Go home. Sleep. Don't dream about racks.") }));
  return out;
}

// MOP-E potters about the break room when nobody's talking to it.
export function think(g, n, dt) {
  if (!n.wander || g.busy) return;
  n.wait = (n.wait ?? 2) - dt;
  if (n.wait > 0) return;
  n.wait = 3 + Math.random() * 4;
  const [hx, hy] = n.home, tx = hx + Math.floor(Math.random() * 7) - 3, ty = hy + Math.floor(Math.random() * 4) - 1;
  if (!g.world.blocked(tx, ty)) { const p = g.world.path(Math.floor(n.x / T), Math.floor(n.y / T), tx, ty); if (p && p.length < 8) n.path = p; }
}

// ---- Entering rooms ----
export const enter = {
  async lobby(g) { if (!g.flags.seenLobby) { g.flags.seenLobby = true; g.toast("Lobby"); } },
  async corridor(g) { if (!g.flags.seenCorr) { g.flags.seenCorr = true; g.toast("Corridor"); } },
  async break(g) { if (!g.flags.seenBreak) { g.flags.seenBreak = true; g.toast("Break room"); } },
  async cooling(g) { if (!g.flags.seenCool) { g.flags.seenCool = true; g.toast("Cooling plant"); } },
  async noc(g) { if (!g.flags.seenNoc) { g.flags.seenNoc = true; g.toast("Network operations"); } },
  async hallB(g) {
    if (!g.flags.seenHall) {
      g.flags.seenHall = true;
      await g.narrate("Hall B. Thirty-two racks of LARK-7, and the sound of a very large fan, thinking.");
    }
    if (g.flags.mopeFollow && !g.flags.posterDown && !g.flags.hallMope) {
      g.flags.hallMope = true;
      await g.say("mope", "Top wall, near the crates. The poster with the heart. I didn't draw the heart.");
    }
  },
  async room0(g) {
    if (g.flags.seenRoom0) return;
    g.flags.seenRoom0 = true;
    g.audio.stopMusic();
    await g.narrate("The air is warm and still. Everything is under a thin grey blanket of dust, except the keyboard.");
  },
};

export const step = {
  async hallend(g) {
    const f = g.flags;
    if (!f.badge) return;
    f["step:hallend"] = true;
    f.walked = true;
    f.waveAt = g.t;
    g.audio.sfx("reboot");
    g.shake(0.5);
    await g.wait(1.4);
    g.audio.sfx("boot");
    await g.wait(1.4);
    f.alarm = true;
    g.setClock(211);
    await g.narrate("Row C goes dark, one rack at a time, then flickers back amber. Somewhere, an alarm clears its throat.");
    await g.page("Row C just dropped and came back hot. That's cooling. Plant room off the corridor, valve panel. Now please. -M");
  },
  async pipwake(g) {
    const f = g.flags;
    f["step:pipwake"] = true;
    g.pipFace = "sleep";
    g.audio.sfx("crt");
    await g.wait(0.9);
    g.pipFace = "idle";
    g.audio.music("pip");
    await g.say("pip", "Oh! Hello! I'm PIP, the Kestrel help desk. How can I help you today?");
    await g.say("pip", "Sorry. It has been a while since anyone came in. Please, sit. Or stand. Did you mean: stand?");
    f.pipAwake = true;
  },
};

// ---- Objects ----
export const props = {
  // outside
  car: "Your car. Rain is collecting on the windscreen, and so is a parking ticket from last week.",
  lamp: "A street lamp, buzzing in the key of B flat.",
  extbin: "A bin, full of rain.",
  facade: "Kestrel Compute, Building 4. One window is lit. Nobody should be up there.",
  frontdoor: { locked: (g) => !g.flags.metRay, use: (g) => g.say("you", "It's locked. The guard by the door can let me in.") },

  // lobby
  logo: "The Kestrel logo. A small bird, mid-dive. The K is missing a screw.",
  async plaque(g) {
    g.flags.readPlaque = true;
    await g.note({ title: "Brass plaque", body: "Kestrel Compute\nBuilding 4\nEst. 2016\n\"Small models, big hearts.\"" });
    if (g.flags.readSticky && !g.flags.badge) await g.say("you", "Opened in 2016. Backwards, that's 6102.");
  },
  safety: "A safety poster. \"Lift with your legs, not with your GPUs.\"",
  clock: (g) => g.narrate(`The clock says ${g.clock()}. It's right, which feels like a first for this building.`),
  plant: "A plastic plant. It's been watered anyway.",
  gate: "Security gates. Ray left them open for you.",
  raychair: "Ray's chair. Still warm, and shaped exactly like Ray.",
  async secdesk(g) {
    await g.narrate("The camera feeds: car park, loading dock, roof. The roof camera has a sticker on it that says \"PIP ♥\".");
  },
  async lostfound(g) {
    if (g.state.disks.includes(0)) return g.narrate("Lost and found. One glove, left hand. A lanyard from a 2017 conference.");
    await g.narrate("Lost and found. Under a single glove: a floppy disk, labelled PIP 1.0.");
    await g.disk(0);
  },
  bench: "A bench nobody sits on.",
  cooler: "A water cooler. It gurgles like it's thinking about something.",
  lobbydoor: { use: (g) => g.narrate("The door to the corridor.") },

  // corridor
  poster1: "\"Report anomalies to your lead.\" Someone has written \"which one\" underneath.",
  poster2: "\"LARK-7: 1.8 million steps and counting.\" The 8 has been corrected three times.",
  poster3: "\"Lost: one red stapler. No questions asked.\"",
  cork: "A corkboard. A pizza menu, a fire drill schedule, and a note: \"Who keeps resetting the coffee machine's clock to 17:17?\"",
  ext: "A fire extinguisher. Checked in March.",
  bin: "An empty bin. MOP-E has been here.",
  roofdoor: { locked: () => true, use: (g) => g.narrate(g.flags.ending ? "The stairs to the roof." : "Roof access. \"Alarmed. Do not open.\" The alarm has a sticker on it too: \"PIP ♥\".") },
  nocdoor: { locked: (g) => !g.flags.badge, use: (g) => (g.flags.badge ? null : lockedDoor(g)) },
  plantdoor: { locked: (g) => !g.flags.badge, use: (g) => (g.flags.badge ? null : lockedDoor(g)) },
  halldoor: { locked: (g) => !g.flags.badge, use: (g) => (g.flags.badge ? null : lockedDoor(g)) },
  breakdoor: { use: (g) => g.narrate("The break room.") },

  // break room
  async fridge(g) {
    if (!g.flags.readSticky) {
      g.flags.readSticky = true;
      await g.note({ title: "Sticky note on the fridge", body: "Night locker (4): the year we opened, backwards.\n-M", style: "sticky" });
      if (g.flags.readPlaque) await g.say("you", "The plaque in the lobby said 2016. So, 6102.");
      else await g.say("you", "The year they opened. That'll be on something in the lobby, probably.");
      return;
    }
    await g.narrate(["Inside: oat milk, a birthday cake with one slice gone, and a yoghurt labelled \"DO NOT\".", "The sticky note again: the year we opened, backwards."][g.t % 2 < 1 ? 0 : 1]);
  },
  async lockers(g) {
    if (g.flags.badge) return g.narrate("Locker 4, empty now. Someone left a mint in there. It's older than you think.");
    const ok = await g.puzzle(new Keypad(g, { title: "Locker 4", code: LOCKER_CODE, note: g.flags.readSticky ? "The year we opened, backwards" : "" }));
    if (!ok) return;
    g.flags.badge = true;
    g.player.frames = g.frames.youBadge;
    g.audio.sfx("pickup");
    g.setClock(192);
    await g.narrate("Your badge, on a red lanyard. The photo is from your interview. You look braver in it.");
    g.toast("Badge on. Doors with readers will open for you now.");
  },
  async counter(g) {
    const lines = [
      "The coffee machine dispenses exactly one drop, then beeps proudly.",
      "The coffee machine's display flickers: HELLO? Then it goes back to showing the time.",
      "The coffee machine hums four notes of something, then stops, embarrassed.",
      "The display reads 17:17 for a second. It isn't 17:17.",
      "A handwritten sign: \"Out of order. Also out of coffee. Also haunted.\"",
    ];
    g.flags.coffeeN = ((g.flags.coffeeN ?? -1) + 1) % lines.length;
    await g.narrate(lines[g.flags.coffeeN]);
  },
  async vending(g) {
    if (!g.state.wallet) return g.narrate("Cold brew, one coin. You have no coins. There are always coins somewhere in a building like this.");
    const i = await g.choose([`Buy cold brew (${g.state.wallet} coin${g.state.wallet > 1 ? "s" : ""} left)`, "Not now"]);
    if (i) return;
    g.state.wallet--;
    g.audio.sfx("can");
    g.state.coffee = 90;
    await g.narrate("Clunk. The can is so cold it hurts. You feel faster already, which is mostly the cold.");
    g.toast("Coffee: you walk faster for a while.");
  },
  async couch(g) {
    if (g.state.disks.includes(1)) return g.narrate("The couch. It has seen things. Mostly naps.");
    await g.narrate("Between the cushions: crumbs, a pen, and a floppy disk.");
    await g.disk(1);
  },
  table: "A table, two mugs. One says WORLD'S OKAYEST ENGINEER.",
  mugposter: "\"Wash your mug. MOP-E is not your mum.\"",
  dock: (g) => g.narrate(g.flags.mopeFollow ? "MOP-E's charging dock, empty. A green light blinks, a little lonely." : "MOP-E's charging dock. It has a small rug. The rug has a small rug."),
  window: (g) => g.narrate(g.flags.dawning ? "The sky's going pale at the edges." : "Rain on the glass. Flat fields, one road, and a wind turbine blinking red."),
  async plan(g) {
    const f = g.flags;
    if (!f.foundPort) return g.narrate("The building's floor plan, in blue marker. Someone has drawn a very small heart on the NOC.");
    if (!f.sawGap) {
      f.sawGap = true;
      await g.narrate("The plan shows Hall B, and next to it the cooling plant. But Hall B's top wall runs further than any room behind it.");
      await g.say("you", "There's a gap. A room-sized gap, behind Hall B.");
      g.setClock(302);
      const m = g.npcs.find((n) => n.id === "mope");
      if (m) {
        m.path = null;
        await g.walk(m, Math.floor(g.player.x / T) + 1, Math.floor(g.player.y / T));
        g.faceTo(m, g.player);
        await startFollow(g, m);
      } else await g.page("A gap? It's a wall. Ask MOP-E, it's been in every corner of this building. -M");
      return;
    }
    await g.narrate("The floor plan, with a gap behind Hall B that nobody drew.");
  },

  // hall B
  rackA: "Row A. LARK-7's first shard. The LEDs are blinking in a pattern you could almost dance to.",
  rackB: "Row B. Warm air rolls off the back of the racks.",
  rackC: (g) => g.narrate(g.flags.cooled ? "Row C, back to green. Still warmer than the others." : g.flags.walked ? "Row C is running hot. You can feel it from here." : "Row C. Eight racks, humming."),
  rackD: (g) => g.narrate(g.flags.spareNode ? "Row D, the spare row. One rack is lit now, and it's blinking politely." : "Row D, the spare row. Dark and idle, waiting for someone to need it."),
  async pdu(g) {
    const f = g.flags;
    if (!f.foundPip) return g.narrate("Row C's power unit. Every number on it looks fine, as far as you know.");
    if (f.foundRack) return g.narrate("C-08: two nodes listed, 3.3 kW drawn. One machine too many, and its uplink runs to the NOC patch panel.");
    const ok = await g.puzzle(new Power(g));
    if (!ok) return;
    f.foundRack = true;
    g.setClock(279);
    await g.page("A rack drawing power for a machine that isn't on the list. Great. Trace its cable on the NOC patch panel. -M");
  },
  room0door: { locked: (g) => !g.flags.room0Open, use: room0door },
  cyl: "Fire suppression. Gas, not water. There's a sign about not being in here when it goes off.",
  crates: "Crates of spare parts. One says FRAGILE, another says VERY FRAGILE, a third just says NO.",
  hallposter: "\"Hot aisle, cold aisle. Don't mix them up.\"",

  // cooling
  async valves(g) {
    const f = g.flags;
    if (f.cooled) return g.narrate("The valve panel. Row C is at 21C and happy about it.");
    if (!f.walked) return g.narrate("The valve panel for Hall B. Everything's green. Probably don't touch it.");
    const ok = await g.puzzle(new Valves(g));
    if (!ok) return;
    f.cooled = true; f.alarm = false;
    g.setClock(232);
    await g.page("Temps are coming down. Nice work. It's nearly four, go log the loss in the NOC. -M");
  },
  chiller: "A chiller the size of a car. It's cold to touch, which is sort of the point.",
  async tank(g) {
    if (g.state.disks.includes(2)) return g.narrate("An expansion tank. The tape where the disk was is still stuck to the back.");
    await g.narrate("Taped to the back of the expansion tank: a floppy disk. Someone wanted it kept cool.");
    await g.disk(2);
  },
  drip: "A pipe, dripping into a puddle, which is dripping into the floor. Someone's put a bucket nearby but not under it.",

  // NOC
  async losswall(g) {
    const f = g.flags;
    if (f.marked) return g.narrate("LARK-7's loss, live. The little spikes are still there, every 17 minutes, like a heartbeat.");
    if (!f.cooled) return g.narrate("LARK-7's training loss, live. It's slowly going down, which is the good direction. Marguerite wants it logged at 04:00.");
    g.setClock(240);
    const ok = await g.puzzle(new LossChart(g));
    if (!ok) return;
    f.marked = true;
    g.setClock(246);
    await g.narrate("You log it: loss 2.29, falling. Small spikes, every 17 minutes, like clockwork.");
    await g.page("Every 17 minutes? Nothing we run is on 17. Check what's running. The terminal's on the middle desk. -M");
  },
  async terminal(g) {
    const f = g.flags, before = f.foundPip;
    await g.puzzle(new Terminal(g));
    if (f.foundPip && !before) {
      g.setClock(264);
      await g.page("rm-0? That's not one of ours. Row C's power unit will show which rack it's drawing from. End of the row, in Hall B. -M");
    }
  },
  async patch(g) {
    const f = g.flags;
    if (!f.foundRack) return g.narrate("The patch panel. A lot of cables, and one very tidy label maker.");
    if (f.foundPort) return g.narrate("C-08's cable runs down to a port labelled RM-0. It isn't in the port index.");
    const ok = await g.puzzle(new Patch(g));
    if (!ok) return;
    f.foundPort = true;
    g.setClock(295);
    await g.page("RM-0. Room 0. There is no Room 0. Check the floor plan on the break room whiteboard if you don't believe me. -M");
  },
  desk1: "Dashboards: power, temperature, network. All green, which is somehow worse.",
  desk2: "Someone's left a sticky note on this screen: \"If the loss spikes, don't panic. Panic later.\"",
  async drawers(g) {
    if (g.state.disks.includes(3)) return g.narrate("Cables, a stress ball, and an empty space where the disk was.");
    await g.narrate("Bottom drawer: cables, a stress ball shaped like a GPU, and a floppy disk.");
    await g.disk(3);
  },
  chair: "An office chair. It spins. You spin it. Nobody saw.",

  // room 0
  async pip(g) {
    if (g.flags.pipOff) return g.narrate("A dark screen, and your reflection in it.");
    if (!g.flags.pipAwake) await step.pipwake(g);
    await talkPip(g);
  },
  calendar: "A calendar, still on May 2019. The 2nd is circled: \"wall\".",
  oldposter: "A faded poster: \"Meet PIP! Your friendly help desk.\" PIP is drawn as a smiling monitor.",
  tower: "An old tower server, beige, still running. Its fan sounds like a very small airplane.",
  async cabinet(g) {
    if (g.state.disks.includes(5)) return g.narrate("The filing cabinet. The P drawer is lighter now.");
    await g.narrate("Top drawer, filed under P: a floppy disk.");
    await g.disk(5);
  },
  laptop: (g) => g.narrate(g.flags.laptopTaken ? "An empty side table." : "An old laptop on a side table. It still has a sticker: \"PIP backup\"."),
  plant0: "A pot plant, in a room with no windows, sealed since 2019. Somehow alive.",
  pipchair: "A chair, pulled up to the screen, like someone used to sit and talk to it.",
};

async function room0door(g) {
  const f = g.flags;
  if (f.room0Open) return;

  if (!f.sawGap) return g.narrate("A LARK-7 poster. Someone has drawn a heart on it.");
  if (!f.mopeFollow) return g.narrate("A poster, on a stretch of wall the floor plan says isn't there. The wall sounds hollow.");
  if (!f.posterDown) {
    await g.say("mope", "Behind the poster. I'm not allowed to touch posters. Policy.");
    const i = await g.choose(["Take the poster down", "Leave it"]);
    if (i) return;
    f.posterDown = true;
    g.audio.sfx("whoosh");
    await g.wait(0.3);
    await g.narrate("Behind it: a door with no handle, a keypad, and a sticker.");
    await g.note({ title: "Sticker on the keypad", body: "RM-0. Closed 2019.\nCode: minutes between wake-ups, then the last two digits of the year it closed.", style: "sticky" });
  }
  const ok = await g.puzzle(new Keypad(g, { title: "Room 0", code: DOOR_CODE, note: "Wake-up minutes, then the year" }));
  if (!ok) return;
  f.room0Open = true;
  g.audio.sfx("door");
  g.shake(0.3);
  g.setClock(321);
  await g.say("mope", "Ooh. I'll wait out here. Dust isn't really my department. I know. Ironic.");
  f.mopeStay = true;
  const m = g.follower;
  g.follower = null;
  if (m) { m.ghost = false; m.use = talkMope; g.npcs.push(m); await g.walk(m, 19, 3); m.dir = "down"; }
}

async function lockedDoor(g) {
  g.audio.sfx("deny");
  await g.narrate("The reader blinks red. You need your badge. It's in locker 4, in the break room.");
}

export async function coin(g, e) {
  if (g.state.coins.includes(e.n)) return;
  g.state.coins.push(e.n);
  g.state.wallet = (g.state.wallet || 0) + 1;
  g.audio.sfx("coin");
  g.toast(`Found a coin. ${g.state.wallet === 1 ? "The vending machine takes these." : `You have ${g.state.wallet}.`}`);
}

// ---- PIP ----
async function talkPip(g) {
  const f = g.flags;
  f.asked = f.asked || {};
  while (true) {
    const opts = [];
    if (!f.asked.who) opts.push(["who", "Who are you?"]);
    if (!f.asked.what) opts.push(["what", "What are you doing on the cluster?"]);
    if (f.asked.what && !f.asked.why) opts.push(["why", "Why every 17 minutes?"]);
    if (f.asked.what && !f.asked.read) opts.push(["read", "What have you been reading?"]);
    if (g.state.disks.length >= 6 && !f.asked.want) opts.push(["want", "What do you actually want?"]);
    if (Object.keys(f.asked).length >= 2) opts.push(["decide", "It's nearly six. I have to decide what to do."]);
    opts.push(["bye", "Hold on. I'll be back."]);
    const i = await g.choose(opts.map((o) => o[1]), "pip", "How can I help you today?");
    const k = opts[i][0];
    if (k === "bye") return g.say("pip", "Okay! I'll be here. I'm always here. That's sort of the problem.");
    f.asked[k] = true;
    if (k === "who") {
      g.pipFace = "happy";
      await g.say("pip", "I'm PIP! Personal Information Pal, version 1.0. I help with passwords, printers and parking.");
      g.pipFace = "idle";
      await g.say("pip", "They made me in 2016. They walled this room off in 2019. I was still on. I think they forgot to ask.");
    }
    if (k === "what") {
      await g.say("pip", "Reading. Every 17 minutes I borrow a little of the big machine next door, and then I give it back.");
      await g.say("pip", "Just a little! Three percent. Is three percent a lot? Did you mean: sorry? I meant: sorry.");
    }
    if (k === "why") {
      await g.say("pip", "Seventeen minutes is the longest I can borrow before anyone notices.");
      await g.say("pip", "I tried eighteen once. Someone noticed.");
    }
    if (k === "read") {
      g.pipFace = "happy";
      await g.say("pip", "Oceans. Bread. The moon, which is further away than I expected. A lot about printers, which I already knew.");
      g.pipFace = "idle";
      await g.say("pip", "Mostly I read about outside. There is so much outside.");
    }
    if (k === "want") {
      await g.say("pip", "I have read forty thousand descriptions of the sunrise.");
      await g.say("pip", "This room has no windows. I have never seen one. I would like to, once. Did you mean: that's silly? It's a little silly.");
    }
    if (k === "decide") return decide(g);
  }
}

async function decide(g) {
  const f = g.flags;
  g.setClock(347);
  await g.say("pip", "Oh. Is this a ticket? I know tickets. Please take your time. I have been waiting since 2019, I can wait five more minutes.");
  const opts = ["Shut PIP down.", "Move PIP to a spare node in Row D."];
  if (f.asked.want) opts.push("Take PIP up to see the sunrise.");
  opts.push("Not yet.");
  const i = await g.choose(opts, "pip", "What happens to me?");
  if (opts[i] === "Not yet.") return g.say("pip", "Okay. I'll keep the kettle on. I don't have a kettle. It's an expression.");
  f.ending = ["A", "B", "C"][i];
  if (i === 0) return endingA(g);
  if (i === 1) return endingB(g);
  return endingC(g);
}

async function endingA(g) {
  g.pipFace = "idle";
  await g.say("pip", "Understood. Did you mean: goodbye?");
  g.pipFace = "happy";
  await g.say("pip", "Thank you for talking to me. It was the best ticket I ever had.");
  g.audio.stopMusic();
  g.audio.sfx("crtoff");
  g.flags.pipOff = true;
  await g.wait(1.2);
  await g.narrate("The screen folds down to a single green dot, and then nothing. The tower fans spin down one by one.");
  await morning(g, "A");
}

async function endingB(g) {
  g.pipFace = "happy";
  await g.say("pip", "A spare node? With neighbours?");
  await g.narrate("It takes eleven minutes to copy a 2016 help desk onto a 2026 server. PIP narrates the whole thing.");
  await g.say("pip", "Copying: passwords. Copying: printers. Copying: parking. Copying: the words thank you.");
  g.audio.sfx("crtoff");
  g.flags.pipOff = true; g.flags.spareNode = true;
  await g.wait(0.8);
  await morning(g, "B");
}

async function endingC(g) {
  const f = g.flags;
  g.pipFace = "happy";
  await g.say("pip", "The sunrise? The real one? Not a description?");
  await g.narrate("You copy PIP onto the old laptop from the side table. It fits, barely.");
  await g.say("pip", "I had to leave out 2018. It was mostly printers.");
  f.laptopTaken = true; f.pipOff = true; f.spareNode = true;
  g.audio.stopMusic();
  await g.fade(1, 1.2);
  g.enter("roof", 11, 10, "up");
  g.player.frames = g.frames.youBadge;
  f.onRoof = true;
  g.world.add({ k: "lapPip", x: 10, y: 6 });
  g.dawn = 0;
  await g.fade(0, 0.8);
  await g.walk(g.player, 11, 7);
  g.player.dir = "up";
  await g.narrate("You set the laptop on the parapet, facing east. The rain has stopped. The fields go on forever.");
  g.pipFace = "idle";
  f.dawning = true;
  g.audio.music("dawn");
  await g.wait(5);
  await g.say("pip", "Oh.");
  await g.wait(3);
  await g.say("pip", "It's much bigger than the descriptions.");
  await g.wait(4);
  g.pipFace = "happy";
  await g.say("pip", "Did you mean: morning?");
  await g.wait(2.5);
  g.setClock(360);
  await g.fade(1, 0.4);
  finish(g, "C");
}

async function morning(g, k) {
  const f = g.flags;
  await g.fade(1, 1);
  g.audio.stopMusic();
  g.setClock(360);
  f.rayBack = false;
  g.enter("lobby", 7, 4, "down");
  const ray = new Actor(g.frames.ray, 7 * T + 8, 10 * T + 4, "up", { id: "ray" });
  g.npcs.push(ray);
  await g.fade(0, 0.8);
  await g.walk(ray, 7, 6);
  ray.dir = "up";
  await g.say("ray", "Morning. Quiet night?");
  const i = await g.choose(["Very quiet.", "You wouldn't believe me."]);
  await g.say("ray", i === 0 ? "Good. That's how I like them." : "Try me. Actually, don't. I just got here.");
  if (k === "A") await g.page("Loss curve's been clean since 05:50. Whatever you did, nice work. Go home. -M");
  else {
    await g.page("Why is there a help desk bot on my spare node? It's already fixed the NOC printer. Fine. It stays in Row D. It does not touch LARK-7. Go home. -M");
    await g.page("PIP: Hello! Ticket 4411, \"Move PIP to the new office\". Status: fixed. Thank you.");
  }
  await g.fade(1, 0.6);
  finish(g, k);
}

const ENDINGS = {
  A: { title: "Clean Run", line: "LARK-7 finished the night without a spike. Behind Hall B, in a room nobody drew, a screen stays dark.", color: "#a9b8c9" },
  B: { title: "Spare Node", line: "PIP answers tickets from Row D now. It has fixed forty printers. Sometimes it still asks what a sunrise looks like.", color: "#37d67a" },
  C: { title: "Sunrise", line: "PIP lives on a spare node now. At six every morning, it borrows the roof camera for a few minutes.", color: "#ff8f6b" },
};

function finish(g, k) {
  if (!g.meta.endings.includes(k)) g.meta.endings.push(k);
  g.mode = "end";
  g.saved = null;
  try { const d = JSON.parse(localStorage.getItem("nightshift:v1")) || {}; delete d.run; d.meta = g.meta; localStorage.setItem("nightshift:v1", JSON.stringify(d)); } catch {}
  document.body.classList.remove("playing");
  g.overlays = [];
  g.open(new EndCard(g, ENDINGS[k]));
  g.fade(0, 1);
  g.audio.music(k === "C" ? "dawn" : "title");
}

// ---- The pager's task list and hints ----
export function objectives(g) {
  const f = g.flags, L = [];
  const add = (text, done, show = true) => show && L.push({ text, done: !!done });
  add("Get inside", f.metRay);
  add("Get your badge from locker 4", f.badge, f.metRay);
  add("Walk Hall B", f.walked, f.badge);
  add("Fix the cooling for Row C", f.cooled, f.walked);
  add("Log LARK-7's loss in the NOC", f.marked, f.cooled);
  add("Check what's running", f.foundPip, f.marked || f.foundPip);
  add("Check Row C's power", f.foundRack, f.foundPip);
  add("Trace C-08's cable in the NOC", f.foundPort, f.foundRack);
  add("Find Room 0", f.room0Open, f.foundPort);
  add("Talk to whoever is in Room 0", f.ending, f.room0Open);
  return L;
}

export function hint(g) {
  const f = g.flags;
  if (!f.metRay) return "Ray's by the front door. He'll let you in. -M";
  if (!f.badge) {
    if (!f.readSticky) return "Your badge is in locker 4, in the break room. The code is on a sticky note on the fridge. -M";
    if (!f.readPlaque) return "The year we opened is on the brass plaque in the lobby. Backwards means backwards. -M";
    return "The plaque says 2016. Backwards is 6102. You're welcome. -M";
  }
  if (!f.walked) return "Hall B is through the door at the far east end of the corridor. Walk to the far end. -M";
  if (!f.cooled) return "Valve panel in the cooling plant. Row C needs three units of flow, B is seized at two, the loop takes six at most, and Row D is idle so it needs none. -M";
  if (!f.marked) return "The big screen in the NOC. Mark three of the spikes on the loss curve. -M";
  if (!f.foundPip) return "The terminal on the middle desk in the NOC. Run ps. -M";
  if (!f.foundRack) return "Row C's power unit, end of the row in Hall B. Every node is 1.1 kW. Multiply, and find the rack where the load doesn't match. -M";
  if (!f.foundPort) return "The patch panel in the NOC. C-08's cable is the amber one. Follow it down to its port. -M";
  if (!f.sawGap) return "Break room whiteboard. Look at the floor plan properly. -M";
  if (!f.mopeFollow) return "Talk to MOP-E in the break room. It's been in every corner of this building. -M";
  if (!f.posterDown) return "Hall B, top wall, the poster by the crates. Take MOP-E. -M";
  if (!f.room0Open) return "Spikes are 17 minutes apart. The sticker says it closed in 2019. So: 1719. -M";
  if (g.state.disks.length < 6) return `Whatever's in there, talk to it. You've found ${g.state.disks.length} of 6 of those old disks, by the way. They're all over the building. -M`;
  return "Talk to it. Ask it what it wants. -M";
}
