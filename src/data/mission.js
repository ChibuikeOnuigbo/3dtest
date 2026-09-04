export const PHASES = {
  ARRIVAL: 'arrival',
  DIAGNOSED: 'diagnosed',
  EQUIPPED: 'equipped',
  RELAY_CLEARED: 'relay-cleared',
  POWERED: 'powered',
  ROUTE_READY: 'route-ready',
  COMPLETED: 'completed',
};

export const OBJECTIVES = {
  [PHASES.ARRIVAL]: 'Inspect the emergency receiver.',
  [PHASES.DIAGNOSED]: 'Enter the keeper’s hall and collect the emergency pulse tool.',
  [PHASES.EQUIPPED]: 'Clear the relay gallery to reach the generator bay.',
  [PHASES.RELAY_CLEARED]: 'Reseat the failed isolator in the generator bay.',
  [PHASES.POWERED]: 'Set the backup channel in the radio workshop.',
  [PHASES.ROUTE_READY]: 'Arm the beacon from the lantern gallery.',
  [PHASES.COMPLETED]: 'Signal held. The ferry has the channel.',
};

export const INTERACTION_COPY = {
  receiver: { label: 'Inspect emergency receiver', verb: 'INSPECT', room: 'Arrival Jetty' },
  cabinet: { label: 'Open emergency tool cabinet', verb: 'OPEN', room: 'Keeper’s Hall' },
  isolator: { label: 'Reseat isolator', verb: 'RESET', room: 'Generator Bay' },
  radio: { label: 'Set backup channel', verb: 'ROUTE', room: 'Radio Workshop' },
  beacon: { label: 'Arm and start beacon', verb: 'ARM', room: 'Lantern Gallery' },
};

export function createInitialMission() {
  return {
    phase: PHASES.ARRIVAL,
    tool: { equipped: false, charges: 6, cooldown: 0 },
    sentries: { 'relay-01': 'patrol', 'relay-02': 'patrol', 'relay-03': 'patrol' },
    doors: {
      entry: { unlocked: false, open: false },
      generator: { unlocked: false, open: false },
      workshop: { unlocked: false, open: false },
      gallery: { unlocked: false, open: false },
    },
    beaconOnline: false,
    endingVisible: false,
  };
}

function message(text, cue = 'deny') {
  return { changed: false, text, cue };
}

export function dispatchMission(state, event) {
  const phase = state.phase;
  const transition = (next, text, cue = 'confirm') => {
    state.phase = next;
    return { changed: true, text, cue, objectiveChanged: true };
  };

  if (event.type === 'door') {
    const door = state.doors[event.id];
    if (!door) return message('That mechanism is not on this circuit.');
    if (!door.unlocked) {
      const requirements = {
        entry: 'The hall lock is waiting for a receiver diagnosis.',
        generator: 'Relay safety has not been cleared.',
        workshop: 'The workshop needs generator power.',
        gallery: 'The lantern lock needs a routed backup channel.',
      };
      return message(requirements[event.id]);
    }
    door.open = !door.open;
    return { changed: true, text: door.open ? 'Door opening.' : 'Door closing.', cue: 'door' };
  }

  if (event.type === 'pulse') {
    if (!state.tool.equipped) return message('The emergency pulse tool is not equipped.');
    if (state.tool.cooldown > 0) return message('Pulse capacitors are recovering.', 'tick');
    if (state.tool.charges <= 0) return message('Pulse cells depleted.');
    state.tool.charges -= 1;
    state.tool.cooldown = 0.45;
    if (!event.target) return { changed: true, text: 'Pulse discharged into open air.', cue: 'pulse' };
    if (state.sentries[event.target] !== 'disabled') state.sentries[event.target] = 'disabled';
    if (event.target === 'relay-01' && phase === PHASES.EQUIPPED) {
      state.doors.generator.unlocked = true;
      return transition(PHASES.RELAY_CLEARED, 'Relay safety bypassed. Generator bay unlocked.', 'pulse-hit');
    }
    return { changed: true, text: 'Sentry pulse suppressed.', cue: 'pulse-hit' };
  }

  const mismatches = {
    receiver: 'The receiver is outside at the jetty.',
    cabinet: 'First determine why the beacon went dark.',
    isolator: 'Clear the relay gallery before entering the generator bay.',
    radio: 'The radio workshop has no power.',
    beacon: 'Route the backup channel before arming the lens.',
  };

  if (event.type === 'interact') {
    if (event.id === 'receiver' && phase === PHASES.ARRIVAL) {
      state.doors.entry.unlocked = true;
      return transition(PHASES.DIAGNOSED, 'Receiver: primary relay lost. Manual restoration required. Hall unlocked.');
    }
    if (event.id === 'cabinet' && phase === PHASES.DIAGNOSED) {
      state.tool.equipped = true;
      return transition(PHASES.EQUIPPED, 'Emergency pulse tool equipped. Clear the relay gallery.', 'equip');
    }
    if (event.id === 'isolator' && phase === PHASES.RELAY_CLEARED) {
      state.doors.workshop.unlocked = true;
      return transition(PHASES.POWERED, 'Isolator seated. Backup power is stable. Workshop unlocked.', 'power');
    }
    if (event.id === 'radio' && phase === PHASES.POWERED) {
      state.doors.gallery.unlocked = true;
      return transition(PHASES.ROUTE_READY, 'Backup channel routed. Lantern gallery unlocked.', 'radio');
    }
    if (event.id === 'beacon' && phase === PHASES.ROUTE_READY) {
      state.beaconOnline = true;
      state.endingVisible = true;
      return transition(PHASES.COMPLETED, 'Beacon armed. Kori Bay channel restored.', 'beacon');
    }
    return message(mismatches[event.id] ?? 'That control is not ready.');
  }

  return message('No valid response from the station.');
}
