import { useState, useRef, useEffect, useCallback } from "react";
import type { BattleSetup, BattleFighter as ApiBattleFighter } from "@workspace/api-client-react";

export type CreatureType = "Fire" | "Water" | "Nature" | "Shadow" | "Light" | "Electric" | "Stone";
export type StatusEffect = "burn" | "shield" | "stun" | "regen";
export type BattlePhase = "selecting" | "animating" | "player-turn" | "enemy-turn" | "result";
export type BattleAction = "attack" | "skill" | "defend" | "swap" | "ultimate";
export type AIDifficulty = "easy" | "normal" | "hard";

export interface StatusState {
  type: StatusEffect;
  turnsLeft: number;
}

export interface Fighter {
  id: number;
  name: string;
  rarity: string;
  type: CreatureType;
  attack: number;
  defense: number;
  speed: number;
  health: number;
  powerScore: number;
  skillName: string;
  skillDescription: string;
  currentHp: number;
  maxHp: number;
  energy: number;
  statuses: StatusState[];
  isDefending: boolean;
}

export interface AnimState {
  playerLunge: boolean;
  enemyLunge: boolean;
  playerShake: boolean;
  enemyShake: boolean;
  playerFade: boolean;
  enemyFade: boolean;
  damagePlayer: number | null;
  damageEnemy: number | null;
  healPlayer: number | null;
  healEnemy: number | null;
  critPlayer: boolean;
  critEnemy: boolean;
  skillGlow: CreatureType | null;
  ultiGlow: CreatureType | null;
  screenFlash: string | null;
}

export interface BattleLog {
  id: number;
  text: string;
  kind: "attack" | "skill" | "ultimate" | "ko" | "status" | "info" | "swap";
}

export interface BattleResult {
  outcome: "win" | "lose";
  survivingIds: number[];
  turnsElapsed: number;
  enemiesDefeated: number;
}

export interface BattleState {
  phase: BattlePhase;
  playerTeam: Fighter[];
  enemyTeam: Fighter[];
  activePlayerIdx: number;
  activeEnemyIdx: number;
  turn: number;
  turnsElapsed: number;
  enemiesDefeated: number;
  isPlayerFirst: boolean;
  log: BattleLog[];
  anim: AnimState;
  result: BattleResult | null;
  pendingSwapMode: boolean;
  difficulty: AIDifficulty;
}

export const TYPE_ADVANTAGES: Record<string, string[]> = {
  Fire: ["Nature", "Stone"],
  Water: ["Fire", "Electric"],
  Nature: ["Water", "Stone"],
  Shadow: ["Light", "Nature"],
  Light: ["Shadow", "Stone"],
  Electric: ["Water", "Light"],
  Stone: ["Fire", "Shadow"],
};

export const ULTIMATE_NAMES: Record<CreatureType, string> = {
  Fire: "Inferno",
  Water: "Glacial Tide",
  Nature: "Ancient Growth",
  Shadow: "Soul Void",
  Light: "Celestial Burst",
  Electric: "Thunder God",
  Stone: "Terra Crush",
};

export const TYPE_COLORS: Record<CreatureType, string> = {
  Fire: "#ef4444",
  Water: "#3b82f6",
  Nature: "#22c55e",
  Shadow: "#8b5cf6",
  Light: "#eab308",
  Electric: "#06b6d4",
  Stone: "#78716c",
};

function typeMultiplier(atk: string, def: string): number {
  if (TYPE_ADVANTAGES[atk]?.includes(def)) return 1.2;
  if (TYPE_ADVANTAGES[def]?.includes(atk)) return 0.85;
  return 1.0;
}

function calcBaseDmg(atk: number, def: number): number {
  return Math.max(4, Math.round((atk * 0.65) - (def * 0.25)));
}

const INITIAL_ANIM: AnimState = {
  playerLunge: false,
  enemyLunge: false,
  playerShake: false,
  enemyShake: false,
  playerFade: false,
  enemyFade: false,
  damagePlayer: null,
  damageEnemy: null,
  healPlayer: null,
  healEnemy: null,
  critPlayer: false,
  critEnemy: false,
  skillGlow: null,
  ultiGlow: null,
  screenFlash: null,
};

function mapApiFighterToFighter(f: ApiBattleFighter): Fighter {
  const boostedHp = Math.round(f.health * 1.42);
  return {
    ...f,
    type: f.type as CreatureType,
    currentHp: boostedHp,
    maxHp: boostedHp,
    energy: 0,
    statuses: [],
    isDefending: false,
  };
}

export function useBattleEngine(difficulty: AIDifficulty = "normal") {
  const [state, setState] = useState<BattleState>({
    phase: "selecting",
    playerTeam: [],
    enemyTeam: [],
    activePlayerIdx: 0,
    activeEnemyIdx: 0,
    turn: 1,
    turnsElapsed: 0,
    enemiesDefeated: 0,
    isPlayerFirst: true,
    log: [],
    anim: { ...INITIAL_ANIM },
    result: null,
    pendingSwapMode: false,
    difficulty,
  });

  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    return () => { timeoutsRef.current.forEach(clearTimeout); };
  }, []);

  const setTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
  }, []);

  const updateState = useCallback((updater: (s: BattleState) => BattleState) => {
    setState(updater);
  }, []);

  const initBattle = useCallback((setup: BattleSetup) => {
    const playerTeam = setup.playerTeam.map(mapApiFighterToFighter);
    const enemyTeam = setup.opponentTeam.map(mapApiFighterToFighter);
    const isPlayerFirst = playerTeam[0].speed >= enemyTeam[0].speed;

    setState({
      phase: isPlayerFirst ? "player-turn" : "enemy-turn",
      playerTeam,
      enemyTeam,
      activePlayerIdx: 0,
      activeEnemyIdx: 0,
      turn: 1,
      turnsElapsed: 0,
      enemiesDefeated: 0,
      isPlayerFirst,
      log: [{ id: Date.now(), text: "Battle started! Choose your action.", kind: "info" }],
      anim: { ...INITIAL_ANIM },
      result: null,
      pendingSwapMode: false,
      difficulty,
    });

    if (!isPlayerFirst) {
      setTimer(() => triggerEnemyAI(stateRef.current), 1200);
    }
  }, [setTimer, difficulty]);

  const processStatuses = (
    fighter: Fighter,
    isPlayer: boolean,
    st: BattleState
  ): { state: BattleState; skipTurn: boolean } => {
    let f = { ...fighter };
    const logs: BattleLog[] = [];
    let dmg = 0;
    let heal = 0;
    let skipTurn = false;

    const hadStun = f.statuses.some(s => s.type === "stun");
    if (hadStun) skipTurn = true;

    f.statuses = f.statuses.map(s => {
      if (s.type === "burn") {
        const d = Math.round(f.maxHp * 0.05);
        dmg += d;
        logs.push({ id: Math.random(), text: `${f.name} burned for ${d} dmg!`, kind: "status" });
      } else if (s.type === "regen") {
        const r = Math.round(f.maxHp * 0.06);
        heal += r;
        logs.push({ id: Math.random(), text: `${f.name} regenerated ${r} HP!`, kind: "status" });
      } else if (s.type === "stun") {
        logs.push({ id: Math.random(), text: `${f.name} is stunned and loses their turn!`, kind: "status" });
      }
      return { ...s, turnsLeft: s.turnsLeft - 1 };
    }).filter(s => s.turnsLeft > 0);

    f.currentHp = Math.min(f.maxHp, Math.max(0, f.currentHp - dmg + heal));

    let newState = { ...st, log: [...st.log, ...logs].slice(-30) };
    if (isPlayer) {
      newState.playerTeam = [...newState.playerTeam];
      newState.playerTeam[newState.activePlayerIdx] = f;
    } else {
      newState.enemyTeam = [...newState.enemyTeam];
      newState.enemyTeam[newState.activeEnemyIdx] = f;
    }

    return { state: newState, skipTurn };
  };

  const checkDeadFighters = (
    st: BattleState,
    onEnd: () => void,
    onContinue: (ns: BattleState) => void
  ) => {
    let ns = { ...st };
    const e = ns.enemyTeam[ns.activeEnemyIdx];
    const p = ns.playerTeam[ns.activePlayerIdx];

    if (e.currentHp <= 0) {
      ns.anim = { ...ns.anim, enemyFade: true };
      ns.enemiesDefeated++;
      ns.log = [...ns.log, { id: Math.random(), text: `${e.name} is knocked out!`, kind: "ko" }];
      updateState(() => ns);

      setTimer(() => {
        let s = { ...stateRef.current };
        const next = s.enemyTeam.findIndex(f => f.currentHp > 0);
        if (next === -1) {
          s.result = { outcome: "win", survivingIds: s.playerTeam.filter(f => f.currentHp > 0).map(f => f.id), turnsElapsed: s.turnsElapsed, enemiesDefeated: s.enemiesDefeated };
          s.phase = "result";
          updateState(() => s);
          onEnd();
        } else {
          s.activeEnemyIdx = next;
          s.anim = { ...s.anim, enemyFade: false };
          s.log = [...s.log, { id: Math.random(), text: `Enemy sends out ${s.enemyTeam[next].name}!`, kind: "swap" }];
          updateState(() => s);
          onContinue(s);
        }
      }, 700);
      return;
    }

    if (p.currentHp <= 0) {
      ns.anim = { ...ns.anim, playerFade: true };
      ns.log = [...ns.log, { id: Math.random(), text: `${p.name} is knocked out!`, kind: "ko" }];
      updateState(() => ns);

      setTimer(() => {
        let s = { ...stateRef.current };
        const next = s.playerTeam.findIndex(f => f.currentHp > 0);
        if (next === -1) {
          s.result = { outcome: "lose", survivingIds: [], turnsElapsed: s.turnsElapsed, enemiesDefeated: s.enemiesDefeated };
          s.phase = "result";
          updateState(() => s);
          onEnd();
        } else {
          s.activePlayerIdx = next;
          s.anim = { ...s.anim, playerFade: false };
          s.log = [...s.log, { id: Math.random(), text: `${s.playerTeam[next].name} enters the battle!`, kind: "swap" }];
          updateState(() => s);
          onContinue(s);
        }
      }, 700);
      return;
    }

    onContinue(ns);
  };

  const performAction = (action: BattleAction, isPlayer: boolean, swapIdx?: number) => {
    let st = { ...stateRef.current };
    st.phase = "animating";
    updateState(() => st);

    const atkIdx = isPlayer ? st.activePlayerIdx : st.activeEnemyIdx;
    const defIdx = isPlayer ? st.activeEnemyIdx : st.activePlayerIdx;

    let atk = { ...isPlayer ? st.playerTeam[atkIdx] : st.enemyTeam[atkIdx] };
    let def = { ...isPlayer ? st.enemyTeam[defIdx] : st.playerTeam[defIdx] };

    const finishTurn = (finalSt: BattleState) => {
      checkDeadFighters(finalSt, () => {}, (ns) => {
        if (ns.phase === "result") return;

        if (isPlayer) {
          const { state: s2, skipTurn } = processStatuses(ns.enemyTeam[ns.activeEnemyIdx], false, ns);
          if (s2.enemyTeam[s2.activeEnemyIdx].currentHp <= 0) {
            checkDeadFighters(s2, () => {}, (s3) => {
              if (s3.phase !== "result") setTimer(() => triggerEnemyAI(stateRef.current), 1400);
            });
            return;
          }
          if (skipTurn) {
            const next = { ...s2, turn: s2.turn + 1, turnsElapsed: s2.turnsElapsed + 1, phase: "player-turn" as BattlePhase };
            updateState(() => next);
            return;
          }
          updateState(() => s2);
          setTimer(() => triggerEnemyAI(stateRef.current), 1400);
        } else {
          const { state: s2, skipTurn } = processStatuses(ns.playerTeam[ns.activePlayerIdx], true, ns);
          if (s2.playerTeam[s2.activePlayerIdx].currentHp <= 0) {
            checkDeadFighters(s2, () => {}, (s3) => {
              if (s3.phase !== "result") {
                updateState(() => ({ ...s3, turn: s3.turn + 1, turnsElapsed: s3.turnsElapsed + 1, phase: "player-turn" }));
              }
            });
            return;
          }
          if (skipTurn) {
            const next = { ...s2, turn: s2.turn + 1, turnsElapsed: s2.turnsElapsed + 1 };
            updateState(() => next);
            setTimer(() => triggerEnemyAI(stateRef.current), 1400);
            return;
          }
          updateState(() => ({ ...s2, turn: s2.turn + 1, turnsElapsed: s2.turnsElapsed + 1, phase: "player-turn" }));
        }
      });
    };

    // --- SWAP ---
    if (action === "swap" && swapIdx !== undefined) {
      const target = isPlayer ? { ...st.playerTeam[swapIdx] } : { ...st.enemyTeam[swapIdx] };
      target.energy = Math.min(100, target.energy + 20);
      if (isPlayer) {
        st.playerTeam = [...st.playerTeam];
        st.playerTeam[swapIdx] = target;
        st.activePlayerIdx = swapIdx;
        st.pendingSwapMode = false;
        st.log = [...st.log, { id: Math.random(), text: `You sent out ${target.name}! (+20 Energy)`, kind: "swap" }];
      } else {
        st.enemyTeam = [...st.enemyTeam];
        st.enemyTeam[swapIdx] = target;
        st.activeEnemyIdx = swapIdx;
        st.log = [...st.log, { id: Math.random(), text: `Enemy swapped to ${target.name}!`, kind: "swap" }];
      }
      updateState(() => st);
      setTimer(() => finishTurn(stateRef.current), 600);
      return;
    }

    // --- DEFEND ---
    if (action === "defend") {
      atk.isDefending = true;
      atk.energy = Math.min(100, atk.energy + 35);
      const negIdx = atk.statuses.findIndex(s => s.type === "burn" || s.type === "stun");
      let extra = "";
      if (negIdx !== -1) {
        extra = ` Cleared ${atk.statuses[negIdx].type}!`;
        atk.statuses = atk.statuses.filter((_, i) => i !== negIdx);
      }
      st.log = [...st.log, { id: Math.random(), text: `${atk.name} braces for impact! (+35 Energy)${extra}`, kind: "info" }];
      if (isPlayer) { st.playerTeam = [...st.playerTeam]; st.playerTeam[atkIdx] = atk; }
      else { st.enemyTeam = [...st.enemyTeam]; st.enemyTeam[atkIdx] = atk; }
      updateState(() => st);
      setTimer(() => finishTurn(stateRef.current), 600);
      return;
    }

    // --- ATTACK / SKILL / ULTIMATE ---
    const isSkill = action === "skill";
    const isUltimate = action === "ultimate";
    const isShieldedByStatus = def.statuses.some(s => s.type === "shield");
    const isDefending = def.isDefending;
    const shieldReduction = isDefending ? 0.5 : (isShieldedByStatus ? 0.65 : 1.0);

    const mult = typeMultiplier(atk.type, def.type);
    const isCrit = Math.random() < 0.08;
    const critMult = isCrit ? 1.35 : 1.0;
    const base = calcBaseDmg(atk.attack, def.defense);

    let dmg = 0;
    let healAmt = 0;
    let statusLog = "";
    let logKind: BattleLog["kind"] = "attack";
    let ignoresShield = false;

    if (action === "attack") {
      atk.energy = Math.min(100, atk.energy + 25);
      dmg = Math.round(base * mult * critMult * shieldReduction);
      logKind = "attack";
    } else if (isSkill) {
      atk.energy = Math.max(0, atk.energy - 60);
      logKind = "skill";
      switch (atk.type) {
        case "Fire":
          dmg = Math.round(base * 1.5 * mult * critMult * shieldReduction);
          def.statuses = [...def.statuses, { type: "burn", turnsLeft: 3 }];
          statusLog = `${def.name} is burning! (5% HP/turn)`;
          break;
        case "Water":
          dmg = Math.round(base * 1.3 * mult * critMult * shieldReduction);
          if (Math.random() < 0.35) {
            def.statuses = [...def.statuses, { type: "stun", turnsLeft: 1 }];
            statusLog = `${def.name} is stunned!`;
          }
          break;
        case "Nature":
          dmg = 0;
          atk.statuses = [...atk.statuses.filter(s => s.type !== "shield" && s.type !== "regen"), { type: "shield", turnsLeft: 3 }, { type: "regen", turnsLeft: 3 }];
          statusLog = `${atk.name} gained Shield & Regen for 3 turns!`;
          break;
        case "Shadow":
          dmg = Math.round(base * 1.4 * mult * critMult * shieldReduction);
          healAmt = Math.round(dmg * 0.5);
          statusLog = `${atk.name} drained ${healAmt} HP from ${def.name}!`;
          break;
        case "Light":
          dmg = Math.round(base * 1.5 * mult * critMult * shieldReduction);
          atk.statuses = atk.statuses.filter(s => s.type !== "burn" && s.type !== "stun");
          statusLog = `${atk.name} is purified of all ailments!`;
          break;
        case "Electric":
          dmg = Math.round(base * 1.5 * mult * critMult * shieldReduction);
          if (Math.random() < 0.35) {
            def.statuses = [...def.statuses, { type: "stun", turnsLeft: 1 }];
            statusLog = `${def.name} is paralyzed!`;
          }
          break;
        case "Stone":
          dmg = 0;
          atk.statuses = [...atk.statuses.filter(s => s.type !== "shield"), { type: "shield", turnsLeft: 3 }];
          atk.isDefending = true;
          statusLog = `${atk.name} fortified with a heavy shield!`;
          break;
      }
    } else if (isUltimate) {
      atk.energy = 0;
      logKind = "ultimate";
      switch (atk.type) {
        case "Fire":
          dmg = Math.round(base * 2.5 * mult * critMult * shieldReduction);
          def.statuses = [...def.statuses, { type: "burn", turnsLeft: 3 }];
          statusLog = `🔥 ${def.name} is engulfed in inferno flames!`;
          break;
        case "Water":
          dmg = Math.round(base * 2.0 * mult * critMult * shieldReduction);
          healAmt = Math.round(atk.maxHp * 0.2);
          statusLog = `💧 ${atk.name} healed ${healAmt} HP from the tidal rush!`;
          break;
        case "Nature":
          dmg = 0;
          atk.statuses = [...atk.statuses.filter(s => s.type !== "shield" && s.type !== "regen"), { type: "shield", turnsLeft: 4 }, { type: "regen", turnsLeft: 4 }];
          healAmt = Math.round(atk.maxHp * 0.3);
          statusLog = `🌿 ${atk.name} rejuvenated and healed ${healAmt} HP!`;
          break;
        case "Shadow":
          dmg = Math.round(base * 2.2 * mult * critMult * shieldReduction);
          healAmt = Math.round(dmg * 0.6);
          statusLog = `💀 Soul Void drained ${healAmt} HP from ${def.name}!`;
          break;
        case "Light":
          dmg = Math.round(base * 2.2 * mult * critMult * shieldReduction);
          atk.statuses = [];
          healAmt = Math.round(atk.maxHp * 0.15);
          statusLog = `✨ ${atk.name} was bathed in celestial light! Healed ${healAmt} HP!`;
          break;
        case "Electric":
          dmg = Math.round(base * 2.2 * mult * critMult * shieldReduction);
          if (Math.random() < 0.6) {
            def.statuses = [...def.statuses, { type: "stun", turnsLeft: 1 }];
            statusLog = `⚡ ${def.name} is thunderstruck and stunned!`;
          }
          break;
        case "Stone":
          ignoresShield = true;
          dmg = Math.round(base * 2.5 * mult * critMult);
          def.statuses = def.statuses.filter(s => s.type !== "shield");
          def.isDefending = false;
          statusLog = `🪨 Terra Crush shattered ${def.name}'s defenses!`;
          break;
      }
    }

    if (!ignoresShield && action === "attack") {
      // shieldReduction already applied above
    }

    dmg = Math.max(0, dmg);
    def.currentHp = Math.max(0, def.currentHp - dmg);
    atk.currentHp = Math.min(atk.maxHp, atk.currentHp + healAmt);

    const newPlayer = [...st.playerTeam];
    const newEnemy = [...st.enemyTeam];
    if (isPlayer) {
      newPlayer[atkIdx] = atk;
      newEnemy[defIdx] = def;
    } else {
      newEnemy[atkIdx] = atk;
      newPlayer[defIdx] = def;
    }
    st.playerTeam = newPlayer;
    st.enemyTeam = newEnemy;

    if (isPlayer) {
      st.anim = { ...st.anim, playerLunge: true };
      if (isSkill) st.anim.skillGlow = atk.type;
      if (isUltimate) { st.anim.ultiGlow = atk.type; st.anim.screenFlash = TYPE_COLORS[atk.type]; }
    } else {
      st.anim = { ...st.anim, enemyLunge: true };
      if (isSkill) st.anim.skillGlow = atk.type;
      if (isUltimate) { st.anim.ultiGlow = atk.type; st.anim.screenFlash = TYPE_COLORS[atk.type]; }
    }
    updateState(() => st);

    setTimer(() => {
      let ns = { ...stateRef.current };
      ns.anim = { ...ns.anim, playerLunge: false, enemyLunge: false, screenFlash: null };
      if (dmg > 0) {
        if (isPlayer) { ns.anim.enemyShake = true; ns.anim.damageEnemy = dmg; ns.anim.critEnemy = isCrit; }
        else { ns.anim.playerShake = true; ns.anim.damagePlayer = dmg; ns.anim.critPlayer = isCrit; }
      }
      if (healAmt > 0) {
        if (isPlayer) ns.anim.healPlayer = healAmt;
        else ns.anim.healEnemy = healAmt;
      }
      updateState(() => ns);
    }, 320);

    setTimer(() => {
      let ns = { ...stateRef.current };
      ns.anim = { ...ns.anim, playerShake: false, enemyShake: false, damageEnemy: null, damagePlayer: null, healPlayer: null, healEnemy: null, skillGlow: null, ultiGlow: null, critPlayer: false, critEnemy: false };

      const skillLabel = atk.skillName;
      const ultiLabel = ULTIMATE_NAMES[atk.type];
      let txt = "";
      if (action === "attack") txt = isPlayer ? `You attacked for ${dmg} dmg!` : `${atk.name} attacked for ${dmg} dmg!`;
      else if (isSkill) txt = isPlayer ? `You used ${skillLabel} for ${dmg > 0 ? dmg + " dmg" : "a buff"}!` : `${atk.name} used ${skillLabel}!`;
      else txt = isPlayer ? `⚡ ULTIMATE: ${ultiLabel}!` : `${atk.name} unleashes ${ultiLabel}!`;

      if (isCrit && dmg > 0) txt += " CRITICAL!";
      if (mult > 1) txt += " Super effective!";
      else if (mult < 1) txt += " Not very effective.";

      ns.log = [...ns.log, { id: Math.random(), text: txt, kind: logKind }];
      if (statusLog) ns.log = [...ns.log, { id: Math.random(), text: statusLog, kind: "status" }];
      ns.log = ns.log.slice(-30);
      updateState(() => ns);
    }, 720);

    setTimer(() => finishTurn(stateRef.current), 1100);
  };

  const triggerEnemyAI = (st: BattleState) => {
    const diff = st.difficulty;
    const e = st.enemyTeam[st.activeEnemyIdx];
    const p = st.playerTeam[st.activePlayerIdx];

    const canUlti = (e.rarity === "Epic" || e.rarity === "Legendary") && e.energy >= 100;
    const canSkill = e.energy >= 60;
    const mult = typeMultiplier(e.type, p.type);
    const hpPct = e.currentHp / e.maxHp;
    const aliveIdx = st.enemyTeam.findIndex((f, i) => i !== st.activeEnemyIdx && f.currentHp > 0);

    let action: BattleAction = "attack";

    if (diff === "easy") {
      const r = Math.random();
      if (r < 0.08 && canUlti) action = "ultimate";
      else if (r < 0.25 && canSkill) action = "skill";
      else if (r < 0.38) action = "defend";
      else action = "attack";
    } else if (diff === "normal") {
      if (hpPct < 0.22) {
        if (aliveIdx !== -1 && Math.random() < 0.25) {
          performAction("swap", false, aliveIdx);
          return;
        }
        action = canSkill && mult >= 1.0 ? "skill" : "defend";
      } else if (canUlti && Math.random() < 0.75) {
        action = "ultimate";
      } else if (canSkill && mult >= 1.2 && Math.random() < 0.75) {
        action = "skill";
      } else if (canSkill && Math.random() < 0.35) {
        action = "skill";
      } else {
        action = Math.random() < 0.18 ? "defend" : "attack";
      }
    } else {
      if (canUlti) {
        action = "ultimate";
      } else if (hpPct < 0.25 && aliveIdx !== -1) {
        performAction("swap", false, aliveIdx);
        return;
      } else if (canSkill) {
        action = "skill";
      } else if (hpPct < 0.4) {
        action = "defend";
      } else {
        action = "attack";
      }
    }

    performAction(action, false);
  };

  const playerAction = useCallback((action: BattleAction, swapToIdx?: number) => {
    const st = stateRef.current;
    if (st.phase !== "player-turn" && !(action === "swap" && swapToIdx === undefined)) return;

    if (action === "swap" && swapToIdx === undefined) {
      updateState(s => ({ ...s, pendingSwapMode: true }));
      return;
    }

    const p = st.playerTeam[st.activePlayerIdx];
    if (action === "skill" && p.energy < 60) return;
    if (action === "ultimate" && p.energy < 100) return;
    if (action === "ultimate" && p.rarity !== "Epic" && p.rarity !== "Legendary") return;

    performAction(action, true, swapToIdx);
  }, [updateState]);

  return {
    state,
    initBattle,
    playerAction,
    cancelSwap: () => updateState(s => ({ ...s, pendingSwapMode: false })),
  };
}
