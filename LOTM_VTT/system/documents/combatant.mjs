export default class LOTM_VTTCombatant extends Combatant {
    _getInitiativeFormula() {
        return String(CONFIG.Combat.initiative.formula || game.system.initiative || this.actor.getInitiativeFormula());
    }
}
