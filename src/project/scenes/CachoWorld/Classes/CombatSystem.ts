import type { Container } from "pixi.js";
import type { CachoWorldPlayer } from "../CachoWorldPlayer";
import { DamageNumber } from "./DamageNumber";
import { ref, set } from "firebase/database";
import { db } from "../../../..";

export class CombatSystem {
	private damageContainer: Container;
	private attackCooldowns: Map<string, number> = new Map();
	private readonly ATTACK_COOLDOWN = 500; // 500ms cooldown between attacks
	private readonly ATTACK_RANGE = 80; // Distance within which players can attack
	private readonly DAMAGE_PER_HIT = 1;
	private roomId: string; // Add roomId to sync HP
	private damageNumbers: DamageNumber[] = [];

	constructor(damageContainer: Container, roomId: string) {
		this.damageContainer = damageContainer;
		this.roomId = roomId;
	}

	/**
	 * Check if attacker can hit target
	 */
	public canAttack(attackerId: string, attacker: CachoWorldPlayer, target: CachoWorldPlayer): boolean {
		// Check if on cooldown
		const lastAttackTime = this.attackCooldowns.get(attackerId) || 0;
		const now = Date.now();
		if (now - lastAttackTime < this.ATTACK_COOLDOWN) {
			return false;
		}

		// Check if target is alive
		if (!target.stats.isAlive()) {
			return false;
		}

		// Check distance
		const distance = this.getDistance(attacker, target);
		return distance <= this.ATTACK_RANGE;
	}

	/**
	 * Perform attack from attacker to target
	 */
	public async attack(attackerId: string, attacker: CachoWorldPlayer, target: CachoWorldPlayer): Promise<boolean> {
		if (!this.canAttack(attackerId, attacker, target)) {
			return false;
		}

		// Deal damage
		const remainingHp = target.stats.takeDamage(this.DAMAGE_PER_HIT);

		// Show damage number
		this.showDamageNumber(this.DAMAGE_PER_HIT, target.x, target.y - 30);

		// Set cooldown
		this.attackCooldowns.set(attackerId, Date.now());

		// Sync target HP to Firebase
		await this.syncPlayerHPToFirebase(target.id, target.x, target.y, remainingHp);

		// Log attack
		console.log(`Player ${attackerId} attacked ${target.id}. HP: ${remainingHp}`);

		// Check if target died
		if (remainingHp <= 0) {
			console.log(`Player ${target.id} was defeated!`);
			this.onPlayerDefeated(target);
		}

		return true;
	}

	/**
	 * Sync player HP to Firebase
	 */
	private async syncPlayerHPToFirebase(playerId: string, x: number, y: number, hp: number): Promise<void> {
		try {
			const playerRef = ref(db, `rooms/${this.roomId}/players/${playerId}`);
			await set(playerRef, { x, y, hp });
		} catch (error) {
			console.error("Error syncing player HP to Firebase:", error);
		}
	}

	/**
	 * Get all players within attack range of a player
	 */
	public getPlayersInRange(attacker: CachoWorldPlayer, allPlayers: Record<string, CachoWorldPlayer>): CachoWorldPlayer[] {
		const playersInRange: CachoWorldPlayer[] = [];

		for (const playerId in allPlayers) {
			const player = allPlayers[playerId];

			// Skip self
			if (player.id === attacker.id) {
				continue;
			}

			// Skip dead players
			if (!player.stats.isAlive()) {
				continue;
			}

			// Check distance
			const distance = this.getDistance(attacker, player);
			if (distance <= this.ATTACK_RANGE) {
				playersInRange.push(player);
			}
		}

		return playersInRange;
	}

	/**
	 * Show floating damage number
	 */
	private showDamageNumber(damage: number, x: number, y: number): void {
		const damageNum = new DamageNumber(damage, x, y);
		this.damageContainer.addChild(damageNum);
		// Note: Tween handles animation and cleanup automatically
	}

	/**
	 * Handle player defeat
	 */
	private async onPlayerDefeated(player: CachoWorldPlayer): Promise<void> {
		// Make player semi-transparent
		player.alpha = 0.5;

		// Sync defeated state to Firebase
		await this.syncPlayerHPToFirebase(player.id, player.x, player.y, 0);

		// Respawn after 3 seconds
		setTimeout(async () => {
			player.stats.reset();
			player.alpha = 1;
			console.log(`Player ${player.id} respawned!`);

			// Sync respawn to Firebase
			await this.syncPlayerHPToFirebase(player.id, player.x, player.y, player.stats.getMaxHp());
		}, 3000);
	}

	/**
	 * Calculate distance between two players
	 */
	private getDistance(player1: CachoWorldPlayer, player2: CachoWorldPlayer): number {
		const dx = player1.x - player2.x;
		const dy = player1.y - player2.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	/**
	 * Check if player can currently attack (not on cooldown)
	 */
	public isOnCooldown(playerId: string): boolean {
		const lastAttackTime = this.attackCooldowns.get(playerId) || 0;
		const now = Date.now();
		return now - lastAttackTime < this.ATTACK_COOLDOWN;
	}

	/**
	 * Get remaining cooldown time in milliseconds
	 */
	public getRemainingCooldown(playerId: string): number {
		const lastAttackTime = this.attackCooldowns.get(playerId) || 0;
		const now = Date.now();
		const remaining = this.ATTACK_COOLDOWN - (now - lastAttackTime);
		return Math.max(0, remaining);
	}

	public cleanup(): void {
		// Remove all damage numbers
		this.damageNumbers.forEach((damageNum) => {
			this.damageContainer.removeChild(damageNum);
			damageNum.destroy();
		});
		this.damageNumbers = [];
		this.attackCooldowns.clear();
	}
}
